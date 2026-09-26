# Guess the Age 🎯

A solo, never-ending iOS game: look at a photo of a real person and tap which of
four ages is correct. Built in SwiftUI, no third-party dependencies.

> **Two face styles the player picks from — both royalty-free.**
> - **Cartoon** — illustrated faces drawn in-app (SwiftUI `Canvas`), **all ages
>   incl. children**, works fully offline, no data needed.
> - **AI Photos** — photorealistic synthetic people from `gpt-image-1`
>   (portrait, **adults 18+**), depicting no real person, so no likeness/
>   copyright/royalty concerns. The correct answer is the age each face was made at.
>
> A real-photo path (royalty-free Wikimedia photos with *documented* ages) is also
> available if you prefer real subjects.

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

## Add real faces

The bundled faces are procedural stand-ins. To fill the game with real content
(run on your Mac, not a locked-down sandbox):

**AI-generated people (primary)** — needs an image-model API key:

```bash
export IMAGE_API_KEY=sk-...
python3 tools/generate_faces.py --count 200 --seed-count 50 \
  --image-base-url https://your-cdn.example.com/faces
```

**Real, documented photos (alternative)** — royalty-free Wikimedia, no key:

```bash
python3 tools/build_dataset.py --target 400 --seed-count 50
```

Either writes a bundled offline `seed.json` (+ `Seed/` images) and a full
`manifest.json`. Re-run the app to see them. See **[tools/README.md](tools/README.md)**
for setup, hosting, and the trade-offs between the two.

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
- AI faces carry no name; if you use the real-photo path instead, the subject's
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
