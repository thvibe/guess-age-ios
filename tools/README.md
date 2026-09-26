# Dataset tools

Scripts that produce the photo/face data the app plays with.

## `gen_placeholder_seed.py` — runs anywhere, no network

Writes a placeholder `GuessAge/Resources/seed.json` whose entries have no images,
so the app draws procedural faces. This ships in the repo so the app builds and
runs before you generate real content.

```bash
python3 tools/gen_placeholder_seed.py
```

## `generate_faces.py` — AI-generated faces (primary)

Generates synthetic people at target ages using an OpenAI-compatible Images API.
These faces depict no real person, so there are no likeness/copyright/royalty
concerns. The age is the *intended/apparent* age each face was generated at.

**Adults only (18+) by design** — the tool will not generate images of minors.

Default backend is OpenAI's **`gpt-image-1`**.

```bash
export IMAGE_API_KEY=sk-...            # required
python3 tools/generate_faces.py --count 200 --seed-count 50 \
  --quality medium --size 1024x1536 \
  --image-base-url https://your-cdn.example.com/faces
```

Useful flags / env (flags win over env):

| Flag / env | Default | Notes |
|------------|---------|-------|
| `--quality` / `IMAGE_QUALITY` | `medium` | `low` / `medium` / `high`. Drives cost. |
| `--size` / `IMAGE_SIZE` | `1024x1536` (portrait) | or `1024x1024` / `1536x1024`. |
| `--output-format` / `IMAGE_OUTPUT_FORMAT` | `jpeg` | `jpeg` / `png` / `webp`. |
| `IMAGE_MODEL` | `gpt-image-1` | any OpenAI-compatible model. |
| `IMAGE_API_BASE` | `https://api.openai.com/v1` | point at Azure/gateway to switch backend. |

**gpt-image-1 notes:** it requires a **verified OpenAI organization**, and each
image costs money — roughly `~$0.01` (low) / `~$0.04` (medium) / `~$0.17` (high)
per 1024x1024; portrait/landscape cost more. The script prints a rough estimate
before running. Start with a small `--count` to confirm quality and spend.

Outputs:

| File | Purpose |
|------|---------|
| `GuessAge/Resources/Seed/ai-*.png` | Bundled offline faces (first `--seed-count`). |
| `GuessAge/Resources/seed.json` | Bundled subset; references local images. Plays offline. |
| `GuessAge/Resources/Generated/ai-*.png` | The rest of the generated images. **Host these.** |
| `GuessAge/Resources/manifest.json` | Full set; image URLs = `--image-base-url` + filename. Point `AppConfig.manifestURL` at the hosted copy for the endless streamed pool. |

Point `IMAGE_API_BASE` at Azure OpenAI, a gateway, or any OpenAI-compatible
Images endpoint to use a different backend/model.

> The age label is what the model was asked to render, so it can drift a few
> years from how the face actually reads. For a casual guessing game that's fine;
> if you want tighter labels, run an age-estimation pass over the results and
> store the estimate instead.

## `build_dataset.py` — real, verified photos (alternative)

If you'd rather use **real** people with **documented** ages (and want to include
children, whom the AI path excludes), this pulls royalty-free photos from
**Wikidata + Wikimedia Commons** and computes `age = capture_year − birth_year`
from the subject's birth date and the photo's EXIF capture date. Only
public-domain / CC0 / CC BY / CC BY-SA images are kept, with author + license
recorded for the in-app credits.

```bash
python3 tools/build_dataset.py --target 400 --seed-count 50
```

Requires outbound access to Wikimedia (run on your machine, not a locked-down
sandbox). CC BY / BY-SA require the attribution the app shows on the reveal and
in **About the images** — keep it intact.

---

Both real and AI data use the same JSON shape (`{version, photos:[{id, age,
imageURL?, localImageName?, name?, attribution?}]}`), so the app consumes either
without code changes, and you can even mix them.
