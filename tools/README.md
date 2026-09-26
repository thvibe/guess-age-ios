# Dataset tools

Scripts that produce the photo data the app plays with. (Cartoon mode is drawn
in-app and needs none of this — these are only for the optional **Photos** mode.)

## `gen_placeholder_seed.py` — runs anywhere, no network

Writes a placeholder `GuessAge/Resources/seed.json` whose entries have no images,
so the app draws procedural faces. This ships in the repo so the app builds and
runs before you generate real content.

```bash
python3 tools/gen_placeholder_seed.py
```

## `build_dataset.py` — real, verified photos

Pulls royalty-free photos of **real** people with **documented** ages from
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

Outputs the same JSON shape the app expects (`{version, photos:[{id, age,
imageURL?, localImageName?, name?, attribution?}]}`): a bundled offline
`seed.json` (+ `Seed/` images) for launch, and a full `manifest.json` you can
host and point `AppConfig.manifestURL` at for an endless streamed pool.
