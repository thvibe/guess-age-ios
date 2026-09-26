#!/usr/bin/env python3
"""Pre-generate a set of anime face images (Pollinations, free, no key).

Runs in GitHub Actions (the runner can reach the internet), downloads N anime
portraits at varied adult ages into web/faces/, and writes web/faces/manifest.json.
The web app then serves these statically — reliable and instant, no play-time
rate limits. Adults only (18+).
"""
import argparse
import json
import os
import random
import time
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "faces")

GENDERS = ["man", "woman"]
HAIR = ["short hair", "long hair", "ponytail", "wavy hair", "messy hair", "bob cut", "curly hair"]


def prompt_for(age):
    g = random.choice(GENDERS)
    h = random.choice(HAIR)
    return (
        f"anime portrait illustration, upper body, a {age} year old {g}, {h}, "
        f"soft cel shading, clean line art, studio ghibli style, simple background, "
        f"one person, looking at viewer, safe for work, no text, no watermark"
    )


def fetch(age, seed, dest, tries=4):
    p = urllib.parse.quote(prompt_for(age))
    url = (f"https://image.pollinations.ai/prompt/{p}"
           f"?width=512&height=640&nologo=true&model=flux&seed={seed}")
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "guess-age-faces/1.0"})
            with urllib.request.urlopen(req, timeout=150) as r:
                data = r.read()
            if data and len(data) > 3000:  # a real image, not an error page
                with open(dest, "wb") as f:
                    f.write(data)
                return True
        except Exception as e:  # noqa: BLE001 - best effort
            print(f"  retry age {age}: {e}")
        time.sleep(3 * (i + 1))
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--count", type=int, default=60)
    ap.add_argument("--min-age", type=int, default=18)
    ap.add_argument("--max-age", type=int, default=85)
    ap.add_argument("--delay", type=float, default=1.5)
    args = ap.parse_args()
    min_age = max(18, args.min_age)

    os.makedirs(OUT, exist_ok=True)
    photos = []
    for i in range(args.count):
        age = random.randint(min_age, args.max_age)
        name = f"ai-{i:03d}.jpg"
        if fetch(age, random.randint(0, 2**31 - 1), os.path.join(OUT, name)):
            photos.append({"file": name, "age": age})
            print(f"{i + 1}/{args.count}  age {age}  ok")
        else:
            print(f"{i + 1}/{args.count}  age {age}  FAILED (skipped)")
        time.sleep(args.delay)

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": photos}, f, indent=1)
        f.write("\n")
    print(f"Wrote {len(photos)} faces to web/faces/manifest.json")


if __name__ == "__main__":
    main()
