# Guess the Age 🎯

A solo, never-ending iOS game: look at a photo of a real person and tap which of
four ages is correct. Built in SwiftUI, no third-party dependencies.

> **The player picks a face style — both royalty-free.**
> - **Cartoon** — illustrated faces drawn in-app (SwiftUI `Canvas`), **all ages
>   incl. children**, works fully offline, no data needed. This is the primary,
>   always-available mode.
> - **Photos** (optional) — real people from royalty-free Wikimedia with
>   *documented* ages (portrait, **adults 18+**). The subject's name is hidden
>   while guessing and credited on the answer screen. Needs a dataset built with
>   `tools/build_dataset.py`.

## What's here

```
GuessAge.xcodeproj      Open this in Xcode (16+) and Run.
GuessAge/               SwiftUI app source.
  Models/               AgePhoto + manifest model.
  Game/                 GameViewModel (endless loop, scoring) + AgeOptionGenerator.
  Data/                 DataStore (seed + streamed manifest), ImageLoader, AppConfig.
  Views/                RootView, GameView, PhotoCardView, AnswerButton, AboutView.
  Resources/            seed.json (offline), manifest.json + Seed/ (generated).
GuessAgeTests/          Unit tests for the option generator.
tools/                  Dataset generators (see tools/README.md).
project.yml             XcodeGen spec (optional regeneration path).
```

## Run it

1. Open `GuessAge.xcodeproj` in **Xcode 16+**.
2. Pick an iOS Simulator and press **Run** (⌘R).

Out of the box it plays on a **placeholder seed** (procedurally drawn faces) so
you can try the whole game loop offline immediately. Press **⌘U** to run the unit
tests.

## Add real photos (optional)

Cartoon mode needs no data. To also offer **Photos** mode, build a royalty-free
dataset of real people with *documented* ages (run on your Mac, not a
locked-down sandbox) — Wikimedia, no API key:

```bash
python3 tools/build_dataset.py --target 400 --seed-count 50
```

It writes a bundled offline `seed.json` (+ `Seed/` images) and a full
`manifest.json`. Re-run the app to see them. See **[tools/README.md](tools/README.md)**
for setup and hosting.

## Play in a browser (GitHub Pages)

A web version of the game (Cartoon mode) lives in [`web/`](web/) and is published
to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

- **One-time:** repo **Settings → Pages → Build and deployment → Source: GitHub
  Actions**. (Pages on a private repo needs a paid GitHub plan; public repos are free.)
- Then every push that touches `web/` publishes to **`https://<owner>.github.io/guess-age-ios/`**.

Open that URL on an iPhone in Safari → **Share → Add to Home Screen** to play it
full-screen like an app. This is the free, no-Mac way to try the gameplay; the
native app also lives in Xcode.

## Get it on your iPhone (TestFlight)

A GitHub Actions workflow can build the app in the cloud and deliver it to your
iPhone via TestFlight — no Mac needed after a one-time setup (requires the paid
Apple Developer Program). See **[docs/TESTFLIGHT.md](docs/TESTFLIGHT.md)**.

## Hybrid delivery (offline + streaming)

- **Offline seed:** `GuessAge/Resources/seed.json` loads at launch — the game
  works with no connection.
- **Streamed pool:** host the generated `manifest.json` somewhere and set
  `AppConfig.manifestURL` to its URL. On launch the app appends those photos
  (deduped) so the pool keeps growing — truly endless.

## How it works

- `AgeOptionGenerator` builds four distinct, in-range options around the true age
  (window widens with age), with the truth always included. Pure and unit-tested.
- `GameViewModel` keeps a shuffled queue, refills it endlessly, and tracks score,
  streak, best streak, and accuracy. Streaks grant bonus points.
- Cartoon faces carry no name. If you load the real-photo dataset, the subject's
  **name is hidden while guessing** (it would give recognizable people away) and
  revealed with credit on the answer screen.

## Roadmap (deliberately deferred)

Competitive / multiplayer modes, leaderboards, "within N years" partial scoring,
and a difficulty selector. The data model and game loop are structured to add
these without rework.

## Licensing

App code: add your preferred license. Photo content: public domain / CC0 / CC BY /
CC BY-SA from Wikimedia, with attribution surfaced in the in-app **Photo credits**
screen — keep that screen intact to stay compliant.
