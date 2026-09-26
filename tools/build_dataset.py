#!/usr/bin/env python3
"""Build a verified-age photo dataset for GuessAge from Wikidata + Wikimedia Commons.

How "verified" age works:
  * Wikidata gives each person a documented birth date (property P569) and an
    image (P18) hosted on Wikimedia Commons.
  * Commons exposes each file's capture date (EXIF `DateTimeOriginal`, surfaced
    via the API's `extmetadata`), plus its license and author.
  * age = capture_year - birth_year (month/day adjusted when both are known).

Only royalty-free licenses are kept (public domain / CC0 / CC BY / CC BY-SA),
and author + license + source URL are recorded for attribution.

Outputs:
  * manifest.json  - the full set, referencing Commons thumbnail URLs (stream).
  * seed.json      - a bundled subset that references downloaded local images.
  * Seed/<id>.jpg  - downloaded thumbnails for the seed (offline-first).

This script needs outbound network access to Wikimedia. It is intended to run on
your machine / CI, not inside a restricted sandbox.

Usage:
    python3 tools/build_dataset.py --target 400 --seed-count 50
"""
import argparse
import html
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "GuessAgeDatasetBuilder/0.1 (https://github.com/thvibe/guess-age-ios; contact: maintainer)"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES_DIR = os.path.join(REPO_ROOT, "GuessAge", "Resources")

# Substrings that mark an acceptable, royalty-free license.
ALLOWED_LICENSE_HINTS = ("cc0", "public domain", "cc by", "cc-by", "pd-")
# Explicitly reject non-commercial / no-derivatives variants.
REJECTED_LICENSE_HINTS = ("nc", "nd", "noncommercial", "no derivative")

MIN_AGE, MAX_AGE = 1, 100


def http_get(url, params=None, accept="application/json", retries=4, timeout=60):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": accept,
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            retry_after = e.headers.get("Retry-After") if e.headers else None
            if retry_after and str(retry_after).isdigit():
                time.sleep(min(int(retry_after), 60))   # respect throttling
            else:
                time.sleep(min((2 ** attempt) * 3, 45))
        except Exception as e:  # noqa: BLE001 - network is best-effort
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET failed for {url}: {last_err}")


def sparql_people(limit):
    """One light query for humans that have a birth date and an image.

    Crucially: no ORDER BY and no filters. The query service streams the first
    `limit` matches quickly; an ORDER BY (or a birth-year range FILTER) forces it
    to materialise/sort the whole ~3M-row set and it times out. We keep only the
    photos whose Commons file carries an EXIF capture date — that's where the
    verified age comes from — so we over-fetch candidates here.
    """
    query = f"""
    SELECT ?person ?personLabel ?birth ?image WHERE {{
      ?person wdt:P31 wd:Q5 ;
              wdt:P569 ?birth ;
              wdt:P18 ?image .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT {limit}
    """
    raw = http_get(SPARQL_ENDPOINT, {"query": query, "format": "json"},
                   accept="application/sparql-results+json", retries=3, timeout=55)
    data = json.loads(raw)
    out = []
    for b in data.get("results", {}).get("bindings", []):
        image_url = b.get("image", {}).get("value")
        if not image_url:
            continue
        out.append({
            "qid": b["person"]["value"].rsplit("/", 1)[-1],
            "name": b.get("personLabel", {}).get("value"),
            "birth": b["birth"]["value"],   # ISO-ish, e.g. 1980-05-02T00:00:00Z
            "file": filename_from_commons_url(image_url),
        })
    return out


def filename_from_commons_url(url):
    """P18 values look like .../Special:FilePath/Some%20File.jpg -> 'Some File.jpg'."""
    name = url.rsplit("/", 1)[-1]
    return urllib.parse.unquote(name)


def commons_imageinfo(filenames, thumb_width):
    """Batch-query Commons for license, author, capture date, and a thumb URL."""
    titles = "|".join("File:" + f for f in filenames)
    params = {
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "iiprop": "extmetadata|url",
        "iiurlwidth": str(thumb_width),
        "titles": titles,
    }
    raw = http_get(COMMONS_API, params)
    data = json.loads(raw)
    pages = data.get("query", {}).get("pages", {})
    result = {}
    for page in pages.values():
        title = page.get("title", "")
        fname = title[len("File:"):] if title.startswith("File:") else title
        infos = page.get("imageinfo")
        if not infos:
            continue
        result[fname] = infos[0]
    return result


HTML_TAG_RE = re.compile(r"<[^>]+>")
YEAR_RE = re.compile(r"(\d{4})")


def strip_html(value):
    if not value:
        return ""
    return html.unescape(HTML_TAG_RE.sub("", value)).strip()


def parse_year(date_text):
    """Extract a plausible 4-digit year from a messy Commons date string."""
    if not date_text:
        return None
    m = YEAR_RE.search(date_text)
    if not m:
        return None
    year = int(m.group(1))
    if 1900 <= year <= 2100:
        return year
    return None


def license_ok(license_short):
    l = (license_short or "").lower()
    if not l:
        return False
    if any(bad in l.split() for bad in ("nc", "nd")):
        return False
    if any(bad in l for bad in REJECTED_LICENSE_HINTS):
        return False
    return any(good in l for good in ALLOWED_LICENSE_HINTS)


def build_record(person, info):
    ext = info.get("extmetadata", {})
    license_short = strip_html(ext.get("LicenseShortName", {}).get("value"))
    if not license_ok(license_short):
        return None

    capture = ext.get("DateTimeOriginal", {}).get("value")
    capture_year = parse_year(strip_html(capture))
    birth_year = parse_year(person["birth"])
    if not capture_year or not birth_year:
        return None

    age = capture_year - birth_year
    if age < MIN_AGE or age > MAX_AGE:
        return None

    author = strip_html(ext.get("Artist", {}).get("value")) or "Unknown"
    # Authors can carry long markup; keep it short and clean.
    author = re.sub(r"\s+", " ", author)[:120]

    thumb = info.get("thumburl") or info.get("url")
    source = info.get("descriptionurl")
    if not thumb:
        return None

    return {
        "id": person["qid"],
        "age": age,
        "imageURL": thumb,
        "name": person["name"],
        "attribution": {
            "author": author,
            "license": license_short,
            "sourceURL": source,
        },
    }


def download(url, dest):
    data = http_get(url, accept="image/*")
    with open(dest, "wb") as f:
        f.write(data)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", type=int, default=400, help="number of verified photos to collect")
    ap.add_argument("--seed-count", type=int, default=50, help="how many to bundle offline")
    ap.add_argument("--per-person", type=int, default=1, help="max photos per person")
    ap.add_argument("--thumb-width", type=int, default=512)
    ap.add_argument("--candidates", type=int, default=2000,
                    help="how many people to pull from Wikidata and scan for dated photos")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between API calls")
    ap.add_argument("--res-dir", default=RES_DIR)
    ap.add_argument("--web-dir", default=None,
                    help="if set, download every photo here and write manifest.json for the web app "
                         "(skips the iOS seed/Seed outputs)")
    ap.add_argument("--budget", type=float, default=0,
                    help="wall-clock seconds ceiling for collection (0 = no limit)")
    args = ap.parse_args()

    seed_dir = os.path.join(args.res_dir, "Seed")
    os.makedirs(seed_dir, exist_ok=True)

    collected = []
    per_person = {}
    start = time.time()

    # One cheap query for a big pool of candidates, shuffled for variety, then
    # kept only if Commons has an EXIF capture date (that yields the age).
    people = sparql_people(args.candidates)
    print(f"Fetched {len(people)} candidates from Wikidata.", file=sys.stderr)
    random.shuffle(people)

    for i in range(0, len(people), 50):
        if len(collected) >= args.target:
            break
        if args.budget and time.time() - start > args.budget:
            print(f"Time budget ({args.budget}s) reached; stopping with "
                  f"{len(collected)} photos.", file=sys.stderr)
            break
        chunk = people[i:i + 50]
        files = [p["file"] for p in chunk]
        info_by_file = commons_imageinfo(files, args.thumb_width)
        time.sleep(args.delay)

        for p in chunk:
            if per_person.get(p["qid"], 0) >= args.per_person:
                continue
            info = info_by_file.get(p["file"])
            if not info:
                continue
            rec = build_record(p, info)
            if not rec:
                continue
            per_person[p["qid"]] = per_person.get(p["qid"], 0) + 1
            collected.append(rec)
            if len(collected) >= args.target:
                break

        print(f"Collected {len(collected)}/{args.target} "
              f"(scanned {min(i + 50, len(people))}/{len(people)})", file=sys.stderr)

    if not collected:
        print("Collected nothing — check network access to Wikimedia.", file=sys.stderr)
        sys.exit(1)

    # Web output: download every image locally and write a manifest the web app
    # serves directly (no cross-origin hotlinking, works on GitHub Pages).
    if args.web_dir:
        os.makedirs(args.web_dir, exist_ok=True)
        photos = []
        for rec in collected:
            fname = f"p-{rec['id']}.jpg"
            try:
                download(rec["imageURL"], os.path.join(args.web_dir, fname))
                time.sleep(args.delay)
            except Exception as e:  # noqa: BLE001
                print(f"  skip {fname}: {e}", file=sys.stderr)
                continue
            photos.append({
                "file": fname,
                "age": rec["age"],
                "name": rec["name"],
                "attribution": rec["attribution"],
            })
        with open(os.path.join(args.web_dir, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"version": 1, "photos": photos}, f, indent=1, ensure_ascii=False)
            f.write("\n")
        print(f"Wrote {len(photos)} web photos -> {args.web_dir}")
        return

    # Full streaming manifest.
    manifest_path = os.path.join(args.res_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": collected}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(collected)} photos -> {manifest_path}")

    # Bundled seed: download images and reference them locally.
    seed = []
    for rec in collected[:args.seed_count]:
        local_name = rec["id"]
        dest = os.path.join(seed_dir, local_name + ".jpg")
        try:
            download(rec["imageURL"], dest)
            time.sleep(args.delay)
        except Exception as e:  # noqa: BLE001
            print(f"  skip seed {local_name}: {e}", file=sys.stderr)
            continue
        seed_rec = dict(rec)
        seed_rec["localImageName"] = local_name
        seed_rec.pop("imageURL", None)
        seed.append(seed_rec)

    seed_path = os.path.join(args.res_dir, "seed.json")
    with open(seed_path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": seed}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(seed)} bundled seed photos -> {seed_path}")
    print("Add GuessAge/Resources/Seed/ to the Xcode target as a folder reference.")


if __name__ == "__main__":
    main()
