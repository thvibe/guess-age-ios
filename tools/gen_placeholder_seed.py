#!/usr/bin/env python3
"""Generate a placeholder seed.json for GuessAge.

The placeholder entries carry no image references, so the app draws a
deterministic procedural face (gradient + silhouette) for each one. This lets
the app build and run immediately, before any real photos are fetched.

Run `build_dataset.py` to replace this with real, verified photos.

Usage:
    python3 tools/gen_placeholder_seed.py [--count N] [--out PATH]
"""
import argparse
import json
import os

# A spread of ages so the placeholder game exercises the full option range.
PLACEHOLDER_AGES = [
    3, 6, 9, 12, 15, 18, 21, 24, 27, 30,
    33, 36, 40, 44, 48, 52, 56, 60, 64, 68,
    72, 76, 80, 85, 90,
]

DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "GuessAge", "Resources", "seed.json",
)


def build(count):
    photos = []
    for i in range(count):
        age = PLACEHOLDER_AGES[i % len(PLACEHOLDER_AGES)]
        photos.append({
            "id": f"placeholder-{i:03d}",
            "age": age,
            # No imageURL / localImageName: the app renders a procedural face.
            "name": None,
            "attribution": None,
        })
    return {"version": 1, "photos": photos}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--count", type=int, default=len(PLACEHOLDER_AGES))
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    manifest = build(args.count)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(manifest['photos'])} placeholder photos -> {args.out}")


if __name__ == "__main__":
    main()
