#!/usr/bin/env python3
"""Generate anime-style faces LOCALLY and free, using Stable Diffusion.

No API, no account, no per-image cost — the model runs on your machine
(Apple Silicon / NVIDIA GPU / CPU). Produces the same dataset shape as
tools/generate_faces.py, so the app consumes it identically.

Adults only (18+) by design; the negative prompt also steers away from minors.

Setup (once):
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r tools/requirements-local.txt
    # First run downloads the model (~6-7 GB) from Hugging Face and caches it.

Usage:
    python3 tools/generate_faces_local.py --count 20 --seed-count 20

Notes:
  * Default model is an anime SDXL checkpoint. Override with --model to use any
    diffusers-compatible text-to-image model (e.g. a lighter SD1.5 anime model,
    for which you'd pass --size 512x768).
  * On Apple Silicon this uses the MPS backend; expect ~20-60s per image.
"""
import argparse
import json
import os
import random
import sys

# --- Prompt building (danbooru-style tags suit anime checkpoints) ---
GENDERS = [("1girl", "woman"), ("1boy", "man")]
HAIR = ["short black hair", "long brown hair", "blonde hair", "silver hair",
        "red hair", "dark blue hair", "ponytail", "messy hair", "bob cut", "curly hair"]
EYES = ["brown eyes", "blue eyes", "green eyes", "hazel eyes", "dark eyes"]
EXPR = ["gentle smile", "neutral expression", "calm expression", "soft smile", "friendly expression"]
BG = ["simple background", "soft gradient background", "blurred outdoor background", "plain background"]

NEG = ("lowres, bad anatomy, bad hands, text, watermark, signature, username, error, "
       "missing fingers, extra digits, cropped, worst quality, low quality, jpeg artifacts, "
       "blurry, multiple people, 2girls, 2boys, child, loli, shota")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES_DIR = os.path.join(REPO_ROOT, "GuessAge", "Resources")


def age_tags(age):
    if age < 26:
        return "young adult, youthful face"
    if age < 40:
        return "adult"
    if age < 56:
        return "middle-aged, mature face, slight wrinkles"
    return "elderly, old man or old woman, wrinkles, gray hair, aged face"


def build_prompt(age, rnd):
    tag, word = rnd.choice(GENDERS)
    return (
        f"masterpiece, best quality, very aesthetic, absurdres, "
        f"{tag}, solo, upper body, portrait, looking at viewer, "
        f"{age_tags(age)}, {age} year old {word}, {rnd.choice(HAIR)}, {rnd.choice(EYES)}, "
        f"{rnd.choice(EXPR)}, {rnd.choice(BG)}, soft anime cel shading, detailed eyes"
    )


def pick_device(torch):
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--seed-count", type=int, default=20, help="how many to bundle offline")
    ap.add_argument("--min-age", type=int, default=18, help="lowest age (>=18 enforced)")
    ap.add_argument("--max-age", type=int, default=85)
    ap.add_argument("--model", default="cagliostrolab/animagine-xl-3.1",
                    help="any diffusers text-to-image model id or local path")
    ap.add_argument("--size", default="832x1216", help="WxH (portrait); use 512x768 for SD1.5 models")
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--guidance", type=float, default=6.5)
    ap.add_argument("--device", default="", help="cuda | mps | cpu (default: auto-detect)")
    ap.add_argument("--dtype", default="", help="float16 | float32 (default: fp16 on gpu, fp32 on cpu)")
    ap.add_argument("--image-base-url", default="", help="URL prefix for the streaming manifest")
    ap.add_argument("--res-dir", default=RES_DIR)
    args = ap.parse_args()

    min_age = max(18, args.min_age)  # adults only
    if args.max_age < min_age:
        ap.error("--max-age must be >= 18 and >= --min-age")
    try:
        w, h = (int(x) for x in args.size.lower().split("x"))
    except ValueError:
        ap.error("--size must look like 832x1216")

    try:
        import torch
        from diffusers import AutoPipelineForText2Image
    except ImportError:
        print("Missing deps. Run: pip install -r tools/requirements-local.txt", file=sys.stderr)
        sys.exit(2)

    device = args.device or pick_device(torch)
    if args.dtype:
        dtype = torch.float16 if args.dtype == "float16" else torch.float32
    else:
        dtype = torch.float32 if device == "cpu" else torch.float16
    print(f"Loading {args.model} on {device} ({dtype})... first run downloads ~6GB.",
          file=sys.stderr)

    pipe = AutoPipelineForText2Image.from_pretrained(args.model, torch_dtype=dtype)
    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=True)
    for opt in ("enable_attention_slicing", "enable_vae_slicing"):
        try:
            getattr(pipe, opt)()
        except Exception:  # noqa: BLE001 - optional memory helpers
            pass

    seed_dir = os.path.join(args.res_dir, "Seed")
    gen_dir = os.path.join(args.res_dir, "Generated")
    os.makedirs(seed_dir, exist_ok=True)
    os.makedirs(gen_dir, exist_ok=True)

    rnd = random.Random()
    all_records, seed_records = [], []

    for i in range(args.count):
        age = rnd.randint(min_age, args.max_age)
        prompt = build_prompt(age, rnd)
        img_seed = rnd.randint(0, 2**31 - 1)
        gen = torch.Generator("cpu").manual_seed(img_seed)  # cpu generator works on all backends
        try:
            image = pipe(prompt=prompt, negative_prompt=NEG, num_inference_steps=args.steps,
                         guidance_scale=args.guidance, height=h, width=w, generator=gen).images[0]
        except Exception as e:  # noqa: BLE001 - best effort per image
            print(f"  skip ai-{i:04d}: {e}", file=sys.stderr)
            continue

        name = f"ai-{i:04d}"
        is_seed = len(seed_records) < args.seed_count
        image.save(os.path.join(seed_dir if is_seed else gen_dir, name + ".png"))

        record = {"id": name, "age": age}  # synthetic: no name, no attribution
        if is_seed:
            seed_records.append({**record, "localImageName": name})
        url = (args.image_base_url.rstrip("/") + "/" + name + ".png") if args.image_base_url else name + ".png"
        all_records.append({**record, "imageURL": url})
        print(f"Generated {i + 1}/{args.count} (age {age})", file=sys.stderr)

    if not all_records:
        print("Generated nothing — check the model loaded and the device has memory.", file=sys.stderr)
        sys.exit(1)

    with open(os.path.join(args.res_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": all_records}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    with open(os.path.join(args.res_dir, "seed.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "photos": seed_records}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(seed_records)} bundled seed faces and {len(all_records)} total in manifest.json.")


if __name__ == "__main__":
    main()
