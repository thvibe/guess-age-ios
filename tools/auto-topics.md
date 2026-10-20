# Auto-generated topic tiles from Google Drive

Drop study material into Google Drive and a scheduled Claude routine turns it
into a trivia topic tile on the Trivia League homepage, then pushes it live —
no manual steps.

## How it works

- Source folder in Google Drive: **Vinny School**
  (id `17PrFoG8IGgbb128OLcKn_-hTMwsrOKel`).
- **Each subfolder = one subject** (e.g. `ELA`, `Bio`). The subfolder name is
  the subject; the student is "Vinny".
- **What becomes a tile depends on the material:**
  - **Each PDF study guide = its own tile (one game per PDF).** The unit name
    comes from the PDF's title/first heading (fallback: the cleaned file name).
    - Tile **name** = `"<Subject>: <Unit>"`, e.g. `ELA: Adolescence`.
    - Tile **id** = `vinny-<subject-slug>-<unit-slug>`, e.g.
      `vinny-ela-adolescence`.
    - Example: `Vinny School / ELA / Adolescence Test Study Guide.pdf`
      → the tile **ELA: Adolescence**.
  - **A subfolder of `.md` notes = one merged tile for that subject** (legacy
    style). id = `vinny-<subject-slug>`, name = `"Vinny's <Subject> Test"`.
    - Example: `Vinny School / Bio / {Cell Theory, ...}.md`
      → the tile **Vinny's Biology Test** (`vinny-biology`).
- A scheduled routine (daily) checks for PDFs/subjects that don't yet have a
  tile, reads the material, generates a question bank **strictly** from it,
  **adversarially verifies** every question against the source, then adds the
  tile with `tools/add_topic.mjs`, commits, and pushes to the default branch
  (`claude/age-guessing-game-ios-4rs8x2`), which deploys GitHub Pages.
- **Idempotent & safe:** a PDF/subject already turned into a tile (its id is
  already in `web/index.html`) is skipped, so re-runs never duplicate. The run
  validates the page (syntax + unit tests) before pushing and aborts without
  pushing if anything fails.

### Optional front matter (`.md` only)

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

PDFs take their unit name from the document title, so they need no front
matter.

## The injector (`tools/add_topic.mjs`)

Deterministically adds a topic to `web/index.html` from a JSON spec:

```
node tools/add_topic.mjs <spec.json>
```

Spec shape (per-PDF ELA example):

```json
{
  "id": "vinny-ela-adolescence",
  "name": "ELA: Adolescence",
  "icon": "menu_book",
  "accent": "#5a2d82",
  "group": "school",
  "tiers":      ["Rookie Reader","Page Turner","Close Reader","Theme Tracker","Literary Analyst","Master of Literature"],
  "tiersShort": ["Rookie","Pages","Close Read","Themes","Analyst","Master"],
  "blurbs":     ["Just starting to read closely.","...","A master of literature!"],
  "questions": [
    { "q": "Who wrote 'The Party'?",
      "options": ["Pam Munoz Ryan","Audre Lorde","Gary Soto","Adam Bagdasarian"],
      "correct": 0, "d": 1 }
  ]
}
```

`group` is optional and defaults to `"school"` (Drive-sourced test prep shows
under the **School** tab on the home screen; `"fun"` puts it under Just for Fun).

Rules enforced: id is a unique lowercase slug; 6 tiers/tiersShort/blurbs;
each question has 4 plain-text options with the correct answer FIRST
(`correct: 0`; the app shuffles at render), difficulty `d` 1-4, no double-quote
characters anywhere, no duplicate questions. It SKIPs (does nothing) if the id
already exists.

## Setting up the schedule (claude.ai Routines)

Because connectors can't always be attached to a trigger programmatically in
this org, create the routine from the claude.ai Routines/Automations UI so you
can attach the **Google Drive** connector:

1. New routine → **new session each run**, environment = this project's
   environment, schedule = daily.
2. Attach the **Google Drive** connector (and allow GitHub / shell).
3. Paste the prompt below.

### Routine prompt

> You are an automated job for the "Trivia League" web app (repo
> thvibe/guess-age-ios). Turn new study material in Google Drive into trivia
> topic tiles on the homepage and push them live, autonomously. Do not ask
> questions; use ONLY facts from the provided files; never push broken code.
>
> - Repo is in your working directory; default branch
>   `claude/age-guessing-game-ios-4rs8x2` deploys the live site. Work only there.
> - Add tiles ONLY with `node tools/add_topic.mjs <spec.json>` (schema at the
>   top of that file). It is idempotent and validates the spec.
> - Google Drive folder "Vinny School" id `17PrFoG8IGgbb128OLcKn_-hTMwsrOKel`.
>   Each subfolder = one subject; student = "Vinny"; subfolder name = subject.
>
> Tile model:
> - Each **PDF** in a subfolder = its own tile. Unit name = the PDF's
>   title/first heading (fallback: cleaned file name). Tile name =
>   `"<Subject>: <Unit>"`; id = `vinny-<subject-slug>-<unit-slug>`
>   (e.g. ELA / Adolescence → name `ELA: Adolescence`, id `vinny-ela-adolescence`).
> - A subfolder containing `.md` notes (and no per-unit intent) = one merged
>   tile: id `vinny-<subject-slug>`, name `"Vinny's <Subject> Test"`. A `.md`
>   may start with front matter (class/subject/icon/accent) that overrides the
>   folder values.
>
> Steps: (1) `git fetch` + hard-reset to origin/default branch. (2) List every
> subfolder of that folder id and the files in each. (3) Build the work list:
> for each PDF, compute its id as above; for each `.md`-only subject, compute
> its merged id. If `web/index.html` already contains `id: '<that id>'`, SKIP
> it. (4) For each remaining item, read the material (use Drive
> `read_file_content` to extract PDF text), then write 40-55 multiple-choice
> questions STRICTLY from the material (4 options, correct answer FIRST, no
> double-quote characters, difficulty 1-4 roughly d1:12 d2:12 d3:12 d4:9, no
> duplicates). Then ADVERSARIALLY VERIFY every question against the source:
> keep it only if the correct answer is uniquely supported by the material and
> all 3 distractors are clearly wrong; drop anything unsupported, ambiguous, or
> needing outside knowledge. (Fanning this out with the Workflow tool —
> one generator + one verifier per source — gives the best quality.) Build a
> 6-tier themed ladder (tiers/tiersShort/blurbs; e.g. for ELA use
> `["Rookie Reader","Page Turner","Close Reader","Theme Tracker","Literary Analyst","Master of Literature"]`;
> default `["Cramming","Studying","Quiz Whiz","Honor Roll","Top of the Class","Valedictorian"]`),
> write the spec JSON, run the injector. (5) If nothing was added, stop without
> pushing. Else validate (inline-script syntax via `new vm.Script` +
> `node --test web/test/*.test.cjs`); on failure `git checkout -- web/index.html`
> and do not push. (6) On success, one commit (list the subjects/units added)
> ending `Co-Authored-By: Claude <noreply@anthropic.com>`, then
> `git push origin claude/age-guessing-game-ios-4rs8x2`. (7) Report the PDFs and
> subjects found and which were added vs skipped.
