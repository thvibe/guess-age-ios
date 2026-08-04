# Dealer Desk

A 50-state dealer desking calculator. Finance, lease, cash, and balloon, with a
payment grid at the centre and live gross on the side.

> **This directory is a self-contained product with no relationship to the
> `GuessAge` iOS app it currently sits beside.** It lives here only because the
> GitHub App token in the session that built it could not create a new
> repository. See [Moving to its own repo](#moving-to-its-own-repo).

```bash
cd dealer-desk
npm install
npm run dev      # http://localhost:3000
npm test         # 88 unit tests on the engine
npm run build    # production build
```

---

## What this is, and what it deliberately is not

The larger product idea — desking + CRM + AI lead screening + social inbox +
insurance quoting + a dealer↔broker bulletin marketplace — is five products.
Built at once, all five are mediocre. This is **v1: the desking calculator
only**, chosen because it's the daily-use tool with the highest switching cost
and the clearest pass/fail test. A desk manager either trusts the payment or
they never open the tool again.

Everything else is deferred, and the deferral is documented at the bottom.

---

## Architecture

```
src/
  lib/desking/          The engine. Pure TypeScript, no React, no DOM.
    money.ts            Integer-cents money type. Never floats.
    types.ts            Deal, Vehicle, Trade, FiProduct, LenderProgram, Quote.
    amortization.ts     Payment, balloon payment, PV, schedule, APR solve.
    taxes.ts            State tax base derivation + four lease tax regimes.
    fees.ts             Fee handling and statutory doc fee caps.
    profit.ts           Front gross, back gross, finance and lease reserve.
    calculate.ts        The four deal engines + compliance warnings.
    grid.ts             Payment grid (terms × cash down).
  data/
    states.ts           Tax and fee rules for 50 states + DC.
    lenders.ts          Seed lender programs (placeholder rate sheets).
    fiProducts.ts       Default F&I menu.
    incentives.ts       Seed incentives.
    defaultDeal.ts      A fresh deal, pre-filled per state.
  adapters/             Provider interfaces + manual implementations.
  components/           UI.
  app/                  Next.js App Router.
tests/                  Vitest suite over the engine.
```

The engine imports nothing from the UI. That's what makes it testable to 88
cases, and what will let it run server-side or inside a native client later
without a rewrite.

### Money is integer cents, always

`Cents` is a branded integer type. A desking calculator that drifts a penny
across an 84-month amortization is one a desk manager stops trusting, and trust
is the entire product. Floats appear only in rate math (APR, money factor), and
the result is rounded back to cents immediately.

### The taxable base is the hard part, not the rate

Anyone can multiply by 6.25%. The value is in deriving *what* gets multiplied:

| State | Trade-in credit | Rebate taxed? | Lease tax basis |
|---|---|---|---|
| Texas | Full | After rebate | Full vehicle price, at signing |
| California | **None** | **Pre-rebate** | Per monthly payment |
| New York | Full | After rebate | **Entire total of payments, at signing** |
| Florida | Full | After rebate | Per monthly payment (surtax capped at first $5,000) |
| Michigan | **Capped** | After rebate | Per monthly payment |

Every quote carries a plain-English `explanation` trail showing exactly how the
base was reached — the "Show math" toggle in the UI. A desk manager should never
be asked to trust a number they can't audit.

---

## ⚠️ Read this before quoting a live customer

**Every state record is `verified: false`.** The figures are seeded from general
industry knowledge, not from a certified tax service. Doc fee caps and title/reg
schedules change by legislative session; local rates change by ZIP.

The engine distinguishes two things:

- **Structure** (does this state allow a trade credit? how is a lease taxed?) —
  stable, and modelled correctly.
- **Figures** (rates, caps, fee amounts) — go stale. Each record carries a
  `confidence` of `high` / `medium` / `low`.

`confidence: "low"` means the state uses a regime this flat-rate model only
approximates, and the number will be wrong in a way that matters:

| State | Why it's approximated |
|---|---|
| **South Carolina** | Infrastructure Maintenance Fee is **capped per vehicle**. The cap is not implemented — tax is overstated on anything but a cheap car. |
| **Tennessee** | Local tax applies to a bracket, plus a separate single-article tax. Neither is bracketed — local tax is overstated. |
| **Georgia** | TAVT is on fair market value, not selling price. |
| **Oklahoma** | Separate excise tax alongside the reduced sales rate; only sales tax is modelled. |
| **DC** | Excise is tiered by weight and fuel economy. |
| **Kentucky** | Trade-in credit treatment is narrow; verify before relying on it. |
| **Michigan** | Trade credit cap steps up annually — stale every January. |

Warnings for both conditions surface on every quote (`STATE_UNVERIFIED`,
`STATE_APPROXIMATED`) and in the UI's flags panel. Promote a state to
`verified: true` only after a human checks it against the statute.

**Next step for the data:** pick the one or two states your first dealer
actually operates in, verify those against the statute, and mark them verified.
Correct-in-two-states beats plausible-in-fifty.

---

## The adapter layer

Rates, incentives, and insurance are behind provider interfaces
(`src/adapters/types.ts`) with manual, dealer-entered implementations
(`src/adapters/manual.ts`) bound in a single registry (`src/adapters/index.ts`).

This is deliberate. OEM incentives and lender rate sheets come from
contract-gated vendors (Chrome Data, DataOne, MarketScan, RouteOne/Dealertrack)
with long onboarding cycles. Blocking the calculator on a signed contract would
have been the wrong trade. Connecting a real feed later is: implement the
interface, construct it in the registry, done — no engine or UI changes.

Each provider exposes `isLive`, so the UI can honestly label where a number came
from. A desk manager must always be able to tell a published rate from a figure
their GM typed in last month.

**Insurance quoting throws rather than returning fabricated premiums.** A
made-up insurance quote shown to a customer is worse than no quote. The Jerry
integration in the original brief needs confirmation that a partner API exists
before anything is designed against it.

---

## Compliance and guideline warnings

Every quote returns a `warnings[]` array at three levels — `info`, `warn`,
`block`:

- `DOC_FEE_CAPPED` — doc fee trimmed to the statutory cap, and by how much
- `LTV_EXCEEDED`, `ABOVE_MAX_ADVANCE`, `BELOW_MIN_ADVANCE` — lender advance limits
- `BACKEND_EXCEEDED` — financed F&I over the lender's cap
- `TERM_UNAVAILABLE` — term not offered on that program
- `MF_MARKUP_EXCEEDED` — money factor marked up past the lender's limit
- `RATE_BELOW_BUY` — dealer is buying the rate down out of gross
- `NEGATIVE_EQUITY` — how much upside-down money is rolled in
- `LEASE_TAX_UPFRONT` — this state wants the whole lease tax at signing
- `STATE_UNVERIFIED`, `STATE_APPROXIMATED` — data quality

Blocked cells are marked in red in the payment grid. Quoting a deal no lender
will buy wastes an hour and burns credibility with the customer.

---

## Moving to its own repo

This should not live next to an iOS game. Once you've created an empty
`dealer-desk` repo on GitHub:

```bash
./extract-to-repo.sh git@github.com:thvibe/dealer-desk.git
```

The script uses `git subtree split`, so **the commit history for this directory
comes with it** — you don't lose authorship or the build-up. It works on a
temporary clone and never modifies this repository.

---

## Deliberately deferred

Not built, and each is a real decision rather than an oversight:

| Deferred | Why |
|---|---|
| **Auth, multi-tenancy, single-session enforcement** | v1 is a single-user calculator. The "one session per user" rule from the brief is a ~50-line addition once there's a session store. |
| **Dedicated cloud servers per subscriber** | 10–50× the cost and ops burden of logical multi-tenancy, felt at customer #3. Recommend shared infra with hard row-level tenant scoping; dedicated deployment as an enterprise upsell. |
| **Deal persistence / desk log** | The engine is pure and serializable, so `DealInput` is already the save format. Needs a datastore decision first. |
| **CRM, AI lead screening, social inbox** | A separate product against entrenched incumbents (VinSolutions, DealerSocket, Elead). Dealers rarely rip out a CRM; they will switch a calculator. |
| **Dealer↔broker bulletin marketplace** | The actual middleman play, and a different buyer than the desking user. A two-sided marketplace needs both sides seeded before it's useful to either. |
| **VIN decode / inventory** | Needs a VIN decode provider. Fits the existing adapter pattern. |
| **Four-square presentation view** | Worth adding once a real desk manager has used the grid and said what's missing. |
| **Printable/e-signable deal recap** | Reg Z disclosure accuracy is its own compliance workstream. |

---

## Testing

```bash
npm test
```

88 tests covering: float-drift resistance, amortization against known figures,
balloon and zero-rate degenerate cases, APR solving, trade-credit variation
across states, rebate taxability, Florida's surtax base cap, doc fee capping,
all four lease tax regimes, negative equity, over-allowance against front gross,
reserve on rate spread and MF markup, lender guideline warnings, grid
monotonicity, and a sweep asserting all 51 jurisdictions × 4 deal types produce
finite, non-negative, sane output.
