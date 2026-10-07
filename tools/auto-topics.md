# Auto-generated topic tiles from Google Drive

Drop study material into Google Drive and a scheduled Claude routine turns it
into a trivia topic tile on the Trivia League homepage, then pushes it live —
no manual steps.

## How it works

- Source folder in Google Drive: **Vinny School**
  (id `17PrFoG8IGgbb128OLcKn_-hTMwsrOKel`).
- **Each subfolder = one subject = one tile.** The subfolder name is the
  subject; the student is "Vinny". All `.md` files inside a subfolder are the
  study material for that one subject's tile.
  - Example: `Vinny School / Bio / {Cell Theory, Cell Organelles, ...}.md`
    → the tile **Vinny's Biology Test**.
- A scheduled routine (hourly) checks for subfolders that don't yet have a
  tile, reads their `.md` files, generates a question bank strictly from the
  material, and adds the tile with `tools/add_topic.mjs`, then commits and
  pushes to the default branch (`claude/age-guessing-game-ios-4rs8x2`), which
  deploys GitHub Pages.
- **Idempotent & safe:** a subject already turned into a tile is skipped, so
  re-runs never duplicate. The run validates the page (syntax + unit tests)
  before pushing and aborts without pushing if anything fails.

### Optional front matter

A `.md` file may start with a front-matter block to override the
folder-derived values:

```
---
class: Vinny
subject: Biology
icon: biotech
accent: #276a2c
---
```

## The injector (`tools/add_topic.mjs`)

Deterministically adds a topic to `web/index.html` from a JSON spec:

```
node tools/add_topic.mjs <spec.json>
```

Spec shape:

```json
{
  "id": "vinny-biology",
  "name": "Vinny's Biology Test",
  "icon": "biotech",
  "accent": "#276a2c",
  "group": "school",
  "tiers":      ["Single Cell","Tissue","Organ","Organ System","Organism","Master Biologist"],
  "tiersShort": ["Cell","Tissue","Organ","System","Organism","Biologist"],
  "blurbs":     ["Just one cell.","...","A master biologist!"],
  "questions": [
    { "q": "Which organelle is the powerhouse of the cell?",
      "options": ["Mitochondria","Nucleus","Chloroplast","Lysosome"],
      "correct": 0, "d": 1 }
  ]
}
```

`group` is optional and defaults to `"school"` (Drive-sourced test prep shows
under the **School** tab on the home screen; `"fun"` puts it under Just for Fun).

Rules enforced: id is a unique lowercase slug; 6 tiers/tiersShort/blurbs;
each question has 4 plain-text options with the correct answer FIRST
(`correct: 0`; the app shuffles at render), difficulty `d` 1-4, no duplicate
questions. It SKIPs (does nothing) if the id already exists.

## Setting up the schedule (claude.ai Routines)

Because connectors can't be attached to a trigger programmatically in this
org, create the routine from the claude.ai Routines/Automations UI so you can
attach the **Google Drive** connector:

1. New routine → **new session each run**, environment = this project's
   environment, schedule = hourly.
2. Attach the **Google Drive** connector (and allow GitHub / shell).
3. Paste the prompt below.

### Routine prompt

> You are an automated job for the "Trivia League" web app (repo
> thvibe/guess-age-ios). Turn new study-material folders in Google Drive into
> trivia topic tiles on the homepage and push them live, autonomously. Do not
> ask questions; only use facts from the provided files; never push broken code.
>
> - Repo is in your working directory; default branch
>   `claude/age-guessing-game-ios-4rs8x2` deploys the live site. Work only there.
> - Add tiles ONLY with `node tools/add_topic.mjs <spec.json>` (schema at the
>   top of that file). It is idempotent and validates the spec.
> - Google Drive folder "Vinny School" id `17PrFoG8IGgbb128OLcKn_-hTMwsrOKel`.
>   Each subfolder = one subject/test; student = "Vinny"; subfolder name =
>   subject; all `.md` inside = that subject's material. A `.md` may start with
>   front matter (class/subject/icon/accent) that overrides the folder values.
>
> Steps: (1) `git fetch` + hard-reset to origin/default branch. (2) List
> subfolders of that folder id. (3) For each: topic id = `vinny-` + slug of the
> subject; if `web/index.html` already has `id: '<that id>'`, skip; else read
> every `.md`, write 40-55 questions STRICTLY from the material (4 options,
> correct answer first, no double-quotes, difficulty 1-4, ~d1:10 d2:15 d3:15
> d4:7, no duplicates), build a 6-tier themed ladder (tiers/tiersShort/blurbs;
> default `["Cramming","Studying","Quiz Whiz","Honor Roll","Top of the Class","Valedictorian"]`),
> write the spec JSON, run the injector. (4) If nothing added, stop. Else
> validate (inline-script syntax via `new vm.Script` + `node --test web/test/*.test.cjs`);
> on failure `git checkout -- web/index.html` and do not push. (5) On success,
> one commit (list subjects) ending `Co-Authored-By: Claude <noreply@anthropic.com>`,
> then `git push origin claude/age-guessing-game-ios-4rs8x2`. (6) Report the
> subfolders found and which were added vs skipped.
