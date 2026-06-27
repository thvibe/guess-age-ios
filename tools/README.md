# Dataset tools

Two scripts produce the photo data the app plays with.

## `gen_placeholder_seed.py` — runs anywhere, no network

Writes a placeholder `GuessAge/Resources/seed.json` whose entries have no images,
so the app draws procedural faces. This is what ships in the repo so the app
builds and runs before you fetch real photos.

```bash
python3 tools/gen_placeholder_seed.py
```

## `build_dataset.py` — the real, verified-age pipeline (needs network)

Pulls people from **Wikidata** (birth date `P569` + image `P18`) and reads each
image's capture date, license, and author from **Wikimedia Commons**, then keeps
only royalty-free photos and computes `age = capture_year − birth_year`.

```bash
pip install -r tools/requirements.txt   # no-op: stdlib only
python3 tools/build_dataset.py --target 400 --seed-count 50
```

Outputs:

| File | Purpose |
|------|---------|
| `GuessAge/Resources/manifest.json` | Full set; references Commons thumbnail URLs. **Host this** and point `AppConfig.manifestURL` at it for the streamed, endless pool. |
| `GuessAge/Resources/seed.json` | Bundled offline subset; references downloaded local images. Replaces the placeholder seed. |
| `GuessAge/Resources/Seed/*.jpg` | Downloaded seed thumbnails. Add this folder to the Xcode target (it already is, via the synchronized project group). |

### Why the age is "verified"

Each age is derived from two documented facts, not estimated:
- the subject's **birth date** (Wikidata, sourced), and
- the photo's **capture date** (Commons EXIF `DateTimeOriginal`).

Only `public domain / CC0 / CC BY / CC BY-SA` licenses are kept (no `NC`/`ND`),
and author + license + source URL are recorded for the in-app credits screen.

### Licensing / etiquette

- CC BY and CC BY-SA require visible attribution — the app shows it on each
  answer reveal and in **Photo credits**. Don't remove that.
- The streaming manifest hotlinks Commons thumbnails. Wikimedia permits this with
  a descriptive `User-Agent` (already set); for heavy traffic, mirror the images
  to your own host and rewrite the URLs in `manifest.json`.

> Note: this script must run where Wikimedia is reachable (your Mac / CI). Some
> sandboxes block `*.wikimedia.org`.
