# Getting the app onto your iPhone via TestFlight

This repo can build the app in the cloud (GitHub Actions) and deliver it to
your iPhone through **TestFlight** — no Mac required after a one-time setup.

> **Apple requirement:** TestFlight needs the **Apple Developer Program
> ($99/year)**. There is no way to put an app on a physical iPhone without an
> Apple account and Apple code-signing. The free tier only allows 7-day
> installs from a Mac running Xcode.

## One-time setup

### 1. Enroll & register the app
1. Join the **Apple Developer Program**: <https://developer.apple.com/programs/>
2. In **App Store Connect** → **Apps** → **＋** → **New App**, create the app
   with bundle ID **`com.thvibe.guessage`** (or change the bundle ID in Xcode
   and set `APP_IDENTIFIER`). Registering the bundle ID under
   **Certificates, Identifiers & Profiles** happens automatically the first
   time the signed build is created.

### 2. Create an App Store Connect API key
App Store Connect → **Users and Access** → **Integrations / Keys** → **App Store
Connect API** → **Generate API Key** (Access: **App Manager**). Note:
- **Key ID** (e.g. `A1B2C3D4E5`)
- **Issuer ID** (a UUID)
- Download the **`AuthKey_XXXX.p8`** file (you can only download it once)

Also grab your **Team ID** from Developer account → **Membership** (10 chars).

### 3. Add GitHub repository secrets
Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository
secret**:

| Secret | Value |
|--------|-------|
| `ASC_KEY_ID` | the Key ID |
| `ASC_ISSUER_ID` | the Issuer ID |
| `ASC_KEY_P8` | the `.p8` file contents, **base64-encoded** (`base64 -i AuthKey_XXXX.p8 \| pbcopy`) |
| `APPLE_TEAM_ID` | your 10-character Team ID |

## Ship a build
- **Actions** tab → **TestFlight** → **Run workflow**, or push a tag: `git tag v1.0.0 && git push --tags`.
- The job archives with automatic ("cloud") signing using the API key and
  uploads to TestFlight. Processing takes a few minutes on Apple's side.
- On your iPhone, install the **TestFlight** app, sign in with your Apple ID,
  and the build appears. (Add yourself as an internal tester in App Store
  Connect → your app → **TestFlight** if prompted.)

## Notes
- The workflow (`.github/workflows/testflight.yml`) only runs on the manual
  button or a `v*` tag, so normal CI is unaffected and nothing breaks before
  the secrets exist.
- First upload to a new app can also require accepting export-compliance and
  filling minimal app info in App Store Connect once.
- This is a standard starting configuration; the first real run against your
  account may need small tweaks (e.g. team/bundle specifics) — that's expected.
