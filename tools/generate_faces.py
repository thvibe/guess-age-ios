#!/usr/bin/env python3
"""Generate a synthetic-face dataset for GuessAge using an image model.

The game's premise with AI faces: each face is generated at a TARGET age, and
that target is the "correct" answer. These are synthetic people — they depict
no real individuals, so there are no copyright, likeness, or royalty concerns.
The age is an *intended/apparent* age, not a documented one.

RESPONSIBLE USE: this tool generates ADULTS ONLY (min age 18). Generating
photorealistic images of minors is out of scope by design.

Provider: OpenAI's `gpt-image-1` (or any OpenAI-compatible Images API at
`POST {base}/images/generations` returning `data[].b64_json`). Configure via env
(all optional except the key; CLI flags override env):
  IMAGE_API_KEY        (required)  your API key (OPENAI_API_KEY also accepted)
  IMAGE_API_BASE       (default https://api.openai.com/v1)
  IMAGE_MODEL          (default gpt-image-1)
  IMAGE_SIZE           (default 1024x1536 portrait; also 1024x1024|1536x1024)
  IMAGE_QUALITY        (default medium; gpt-image-1: low|medium|high) — drives cost
  IMAGE_OUTPUT_FORMAT  (default jpeg; jpeg|png|webp)
  IMAGE_ART_STYLE      (default anime; anime hand-drawn illustration, or photo)
Point IMAGE_API_BASE at Azure OpenAI, a gateway, or another compatible service
to use a different backend.

Note: gpt-image-1 requires a verified OpenAI organization, and each image costs
money (roughly ~$0.01 low / ~$0.04 medium / ~$0.17 high per 1024x1024 — check
current OpenAI pricing). Start small with --count.

Needs outbound network + a funded key. Run on your machine, not a locked sandbox.

Usage:
  export IMAGE_API_KEY=sk-...
  python3 tools/generate_faces.py --count 200 --seed-count 50 --quality medium
"""
import argparse
import base64
import json
import os
import random
import sys
import time
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES_DIR = os.path.join(REPO_ROOT, "GuessAge", "Resources")

# Variety axes for realistic, diverse portraits. Kept respectful and generic.
GENDERS = ["man", "woman", "person"]
DESCENTS = [
    "East Asian", "South Asian", "Black", "White", "Hispanic or Latino",
    "Middle Eastern", "Southeast Asian", "Pacific Islander", "mixed-heritage",
]
EXPRESSIONS = ["a neutral expression", "a slight smile", "a calm expression",
               "a friendly expression", "a thoughtful look"]
BACKDROPS = ["a plain light-grey studio background", "a soft-focus neutral background",
             "a muted indoor background", "an evenly lit plain background"]
LIGHTING = ["soft natural lighting", "even studio lighting", "gentle window light"]


def build_prompt(age, rnd, art_style):
    gender = rnd.choice(GENDERS)
    descent = rnd.choice(DESCENTS)
    expr = rnd.choice(EXPRESSIONS)
    if art_style == "anime":
        return (
            f"A hand-drawn anime-style portrait illustration of a {age}-year-old "
            f"{descent} {gender}, in the warm, detailed style of a modern Japanese "
            f"animated film (Studio Ghibli / Makoto Shinkai): soft cel shading, clean "
            f"line art, expressive eyes, natural human proportions (not chibi, not "
            f"super-deformed), gentle lighting, a simple soft-focus background. "
            f"Head-and-shoulders, facing the viewer with {expr}. One character only. "
            f"No text, no watermark, no logo, no border, no speech bubbles."
        )
    bg = rnd.choice(BACKDROPS)
    light = rnd.choice(LIGHTING)
    return (
        f"A photorealistic head-and-shoulders portrait photograph of a "
        f"{age}-year-old {descent} {gender}, looking at the camera with {expr}. "
        f"{bg[0].upper()}{bg[1:]}, {light}. Realistic skin texture and age-appropriate "
        f"detail, sharp focus, natural colors, DSLR photo, one person only. "
        f"No text, no watermark, no logo, no border."
    )


EXT = {"jpeg": "jpg", "png": "png", "webp": "webp"}


def generate_one(prompt, cfg):
    """Return (image_bytes, file_extension) for one generated portrait."""
    payload = {
        "model": cfg["model"],
        "prompt": prompt,
        "size": cfg["size"],
        "quality": cfg["quality"],
        "output_format": cfg["fmt"],
        "n": 1,
    }
    req = urllib.request.Request(
        cfg["base"].rstrip("/") + "/images/generations",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {cfg['key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read())
    item = data["data"][0]
    ext = EXT.get(cfg["fmt"], "png")
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"]), ext
    if item.get("url"):  # some compatible backends return a URL instead
        with urllib.request.urlopen(item["url"], timeout=120) as r:
            return r.read(), ext
    raise RuntimeError("API response had neither b64_json nor url")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=200, help="total faces to generate")
    ap.add_argument("--seed-count", type=int, default=50, help="how many to bundle offline")
    ap.add_argument("--min-age", type=int, default=18, help="lowest age (>=18 enforced)")
    ap.add_argument("--max-age", type=int, default=85)
    ap.add_argument("--image-base-url", default="", help="URL prefix where you'll host "
                    "generated images, for the streaming manifest (e.g. https://cdn/faces/)")
    ap.add_argument("--size", default=os.environ.get("IMAGE_SIZE", "1024x1536"),
                    choices=["1024x1024", "1024x1536", "1536x1024", "auto"],
                    help="gpt-image-1 image size (default 1024x1536 = portrait)")
    ap.add_argument("--quality", default=os.environ.get("IMAGE_QUALITY", "medium"),
                    choices=["low", "medium", "high", "auto"],
                    help="gpt-image-1 quality; higher costs more (default medium)")
    ap.add_argument("--output-format", default=os.environ.get("IMAGE_OUTPUT_FORMAT", "jpeg"),
                    choices=["jpeg", "png", "webp"], help="image format (default jpeg)")
    ap.add_argument("--art-style", default=os.environ.get("IMAGE_ART_STYLE", "anime"),
                    choices=["anime", "photo"],
                    help="anime illustration (default) or photorealistic")
    ap.add_argument("--res-dir", default=RES_DIR)
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between API calls")
    args = ap.parse_args()

    min_age = max(18, args.min_age)  # hard floor: adults only
    if args.max_age < min_age:
        ap.error("--max-age must be >= 18 and >= --min-age")

    cfg = {
        "key": os.environ.get("IMAGE_API_KEY") or os.environ.get("OPENAI_API_KEY"),
        "base": os.environ.get("IMAGE_API_BASE", "https://api.openai.com/v1"),
        "model": os.environ.get("IMAGE_MODEL", "gpt-image-1"),
        "size": args.size,
        "quality": args.quality,
        "fmt": args.output_format,
    }
    if not cfg["key"]:
        print("Set IMAGE_API_KEY (see --help).", file=sys.stderr)
        sys.exit(2)

    # Rough cost heads-up (per 1024x1024; check current OpenAI pricing).
    rate = {"low": 0.02, "medium": 0.04, "high": 0.17, "auto": 0.04}.get(args.quality, 0.04)
    print(f"About to generate up to {args.count} {args.art_style} images with "
          f"{cfg['model']} at {args.quality} quality "
          f"(~${rate * args.count:.2f} est.; verify pricing).", file=sys.stderr)

    seed_dir = os.path.join(args.res_dir, "Seed")
    gen_dir = os.path.join(args.res_dir, "Generated")
    os.makedirs(seed_dir, exist_ok=True)
    os.makedirs(gen_dir, exist_ok=True)

    rnd = random.Random()
    all_records, seed_records = [], []

    for i in range(args.count):
        age = rnd.randint(min_age, args.max_age)
        prompt = build_prompt(age, rnd, args.art_style)
        name = f"ai-{i:04d}"
        try:
            img, ext = generate_one(prompt, cfg)
        except Exception as e:  # noqa: BLE001 - best effort per image
            print(f"  skip {name}: {e}", file=sys.stderr)
            time.sleep(args.delay)
            continue

        is_seed = len(seed_records) < args.seed_count
        target_dir = seed_dir if is_seed else gen_dir
        filename = f"{name}.{ext}"
        with open(os.path.join(target_dir, filename), "wb") as f:
            f.write(img)

        record = {"id": name, "age": age}  # synthetic: no name, no attribution
        if is_seed:
            seed_records.append({**record, "localImageName": name})
        manifest_url = (args.image_base_url.rstrip("/") + "/" + filename) \
            if args.image_base_url else filename
        all_records.append({**record, "imageURL": manifest_url})

        if (i + 1) % 10 == 0:
            print(f"Generated {i + 1}/{args.count}...", file=sys.stderr)
        time.sleep(args.delay)

    if not all_records:
        print("Generated nothing — check IMAGE_API_KEY / network / quota.", file=sys.stderr)
        sys.exit(1)

    with open(os.path.join(args.res_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": all_records}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    with open(os.path.join(args.res_dir, "seed.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": seed_records}, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {len(seed_records)} bundled seed faces (Resources/Seed/) and "
          f"{len(all_records)} total in manifest.json.")
    print("Host Resources/Generated/ (and the seed images) and pass their URL prefix via "
          "--image-base-url, then point AppConfig.manifestURL at the hosted manifest.json.")


if __name__ == "__main__":
    main()
