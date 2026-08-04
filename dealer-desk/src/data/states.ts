import { dollars } from "@/lib/desking/money";
import type { StateCode, StateRule, TradeInCredit } from "@/lib/desking/types";

/**
 * Vehicle tax and fee rules for all 50 states + DC.
 *
 * ------------------------------------------------------------------------
 * READ THIS BEFORE YOU SHIP A DEAL OFF THESE NUMBERS.
 * ------------------------------------------------------------------------
 * Every record here is seeded from general industry knowledge, NOT from a
 * certified tax service, and every one carries `verified: false`. Doc fee caps
 * and title/registration schedules change by legislative session; local rates
 * change by ZIP. The *structure* (does this state allow a trade-in credit? is a
 * rebate taxed? how is a lease taxed?) is far more stable than the *figures*.
 *
 * `confidence` reflects the figures only:
 *   high   — well-established, slow-moving (e.g. TX 6.25% motor vehicle tax)
 *   medium — correct in structure, figure may be a session or two stale
 *   low    — the state uses an unusual regime (excise, ad valorem, weight-based)
 *            that this flat-rate model only approximates. Treat as a placeholder.
 *
 * A state is promoted to `verified: true` only when a human has checked it
 * against the statute. Until then the UI surfaces the unverified badge, and
 * every figure is overridable per dealer.
 */

const ASOF = "2026-08-04";

const FULL: TradeInCredit = { kind: "full" };
const NONE: TradeInCredit = { kind: "none" };
const cap = (max: number): TradeInCredit => ({ kind: "capped", max: dollars(max) });

type StateSeed = Partial<StateRule> &
  Pick<StateRule, "code" | "name" | "stateTaxRate" | "tradeInCredit" | "confidence">;

/** Applies the common-case defaults so each record below states only what differs. */
function defineState(seed: StateSeed): StateRule {
  return {
    typicalLocalTaxRate: 0,
    maxLocalTaxRate: 0,
    rebateReducesTaxableBase: true,
    docFeeCap: null,
    typicalDocFee: dollars(499),
    docFeeTaxable: true,
    titleFee: dollars(75),
    registrationFee: dollars(200),
    plateFee: dollars(25),
    fiProductsTaxable: false,
    leaseTaxBasis: "monthly_payment",
    leaseTradeCredit: true,
    verified: false,
    asOf: ASOF,
    ...seed,
  };
}

export const STATE_RULES: Record<StateCode, StateRule> = {
  AL: defineState({
    code: "AL", name: "Alabama", stateTaxRate: 0.02, confidence: "medium",
    typicalLocalTaxRate: 0.015, maxLocalTaxRate: 0.03, tradeInCredit: FULL,
    titleFee: dollars(18), registrationFee: dollars(105),
    notes: "Reduced 2% state rate applies to automotive sales; county/city add-ons are common.",
  }),
  AK: defineState({
    code: "AK", name: "Alaska", stateTaxRate: 0, confidence: "high",
    typicalLocalTaxRate: 0, maxLocalTaxRate: 0.075, tradeInCredit: FULL,
    titleFee: dollars(15), registrationFee: dollars(100),
    notes: "No statewide sales tax. Boroughs and municipalities may levy their own — set the local override.",
  }),
  AZ: defineState({
    code: "AZ", name: "Arizona", stateTaxRate: 0.056, confidence: "medium",
    typicalLocalTaxRate: 0.022, maxLocalTaxRate: 0.056, tradeInCredit: FULL,
    docFeeCap: dollars(499), typicalDocFee: dollars(499),
    titleFee: dollars(4), registrationFee: dollars(150),
    notes: "Transaction Privilege Tax. Vehicle License Tax is assessed separately on value and is not modeled here.",
  }),
  AR: defineState({
    code: "AR", name: "Arkansas", stateTaxRate: 0.065, confidence: "medium",
    typicalLocalTaxRate: 0.025, maxLocalTaxRate: 0.05, tradeInCredit: FULL,
    titleFee: dollars(10), registrationFee: dollars(150),
  }),
  CA: defineState({
    code: "CA", name: "California", stateTaxRate: 0.0725, confidence: "high",
    typicalLocalTaxRate: 0.0175, maxLocalTaxRate: 0.03, tradeInCredit: NONE,
    rebateReducesTaxableBase: false,
    docFeeCap: dollars(85), typicalDocFee: dollars(85),
    titleFee: dollars(25), registrationFee: dollars(400), plateFee: dollars(65),
    notes:
      "No trade-in tax credit — tax is on the full selling price. Rebates do not reduce the taxable base. " +
      "District taxes vary sharply by ZIP; always set the local override. Doc fee cap is higher for BHPH dealers.",
  }),
  CO: defineState({
    code: "CO", name: "Colorado", stateTaxRate: 0.029, confidence: "medium",
    typicalLocalTaxRate: 0.045, maxLocalTaxRate: 0.083, tradeInCredit: FULL,
    titleFee: dollars(25), registrationFee: dollars(300),
    notes: "Low state rate, high and highly variable local rates. The local override is not optional here.",
  }),
  CT: defineState({
    code: "CT", name: "Connecticut", stateTaxRate: 0.0635, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(25), registrationFee: dollars(120),
    notes: "A higher luxury rate applies above a price threshold; not modeled — override the rate on those deals.",
  }),
  DE: defineState({
    code: "DE", name: "Delaware", stateTaxRate: 0.0425, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(35), registrationFee: dollars(40),
    notes: "No sales tax; a document fee on the vehicle price serves the same role and is modeled as the tax rate.",
  }),
  DC: defineState({
    code: "DC", name: "District of Columbia", stateTaxRate: 0.06, confidence: "low",
    tradeInCredit: FULL, titleFee: dollars(26), registrationFee: dollars(155),
    notes: "Excise tax is tiered by vehicle weight and fuel economy. This flat rate is an approximation — verify per deal.",
  }),
  FL: defineState({
    code: "FL", name: "Florida", stateTaxRate: 0.06, confidence: "high",
    typicalLocalTaxRate: 0.01, maxLocalTaxRate: 0.015, tradeInCredit: FULL,
    titleFee: dollars(78), registrationFee: dollars(225),
    notes:
      "County discretionary surtax applies only to the first $5,000 of the taxable base — the engine caps it. " +
      "No statutory doc fee cap.",
  }),
  GA: defineState({
    code: "GA", name: "Georgia", stateTaxRate: 0.07, confidence: "low",
    tradeInCredit: FULL, titleFee: dollars(18), registrationFee: dollars(20),
    notes:
      "Title Ad Valorem Tax replaces sales tax and is assessed on fair market value, not selling price. " +
      "Modeled as a flat rate on the taxable base — verify against the state TAVT calculator.",
  }),
  HI: defineState({
    code: "HI", name: "Hawaii", stateTaxRate: 0.04, confidence: "medium",
    typicalLocalTaxRate: 0.005, maxLocalTaxRate: 0.005, tradeInCredit: NONE,
    titleFee: dollars(5), registrationFee: dollars(250),
    notes: "General Excise Tax. No trade-in credit.",
  }),
  ID: defineState({
    code: "ID", name: "Idaho", stateTaxRate: 0.06, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(14), registrationFee: dollars(120),
  }),
  IL: defineState({
    code: "IL", name: "Illinois", stateTaxRate: 0.0625, confidence: "medium",
    typicalLocalTaxRate: 0.0175, maxLocalTaxRate: 0.045, tradeInCredit: FULL,
    docFeeCap: dollars(347), typicalDocFee: dollars(347),
    titleFee: dollars(165), registrationFee: dollars(151),
    notes:
      "The $10,000 trade-in credit cap was repealed — full credit applies. Doc fee cap is inflation-indexed annually, " +
      "so treat the figure as stale by default.",
  }),
  IN: defineState({
    code: "IN", name: "Indiana", stateTaxRate: 0.07, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(15), registrationFee: dollars(200),
  }),
  IA: defineState({
    code: "IA", name: "Iowa", stateTaxRate: 0.05, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(25), registrationFee: dollars(300),
    notes: "Levied as a one-time registration fee rather than sales tax; the base treatment is equivalent.",
  }),
  KS: defineState({
    code: "KS", name: "Kansas", stateTaxRate: 0.065, confidence: "medium",
    typicalLocalTaxRate: 0.022, maxLocalTaxRate: 0.045, tradeInCredit: FULL,
    titleFee: dollars(10), registrationFee: dollars(120),
  }),
  KY: defineState({
    code: "KY", name: "Kentucky", stateTaxRate: 0.06, confidence: "low",
    tradeInCredit: NONE, titleFee: dollars(9), registrationFee: dollars(120),
    notes: "Motor vehicle usage tax on retail price. Trade-in credit treatment is narrow — verify before relying on it.",
  }),
  LA: defineState({
    code: "LA", name: "Louisiana", stateTaxRate: 0.0445, confidence: "medium",
    typicalLocalTaxRate: 0.05, maxLocalTaxRate: 0.07, tradeInCredit: FULL,
    docFeeCap: dollars(200), typicalDocFee: dollars(200),
    titleFee: dollars(68), registrationFee: dollars(100),
    notes: "Local rates frequently exceed the state rate. Always set the local override.",
  }),
  ME: defineState({
    code: "ME", name: "Maine", stateTaxRate: 0.055, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(33), registrationFee: dollars(35),
  }),
  MD: defineState({
    code: "MD", name: "Maryland", stateTaxRate: 0.06, confidence: "medium",
    tradeInCredit: FULL, docFeeCap: dollars(500), typicalDocFee: dollars(500),
    titleFee: dollars(100), registrationFee: dollars(187),
    notes: "Titling excise tax. Trade-in credit applies to licensed dealer sales.",
  }),
  MA: defineState({
    code: "MA", name: "Massachusetts", stateTaxRate: 0.0625, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(75), registrationFee: dollars(60),
  }),
  MI: defineState({
    code: "MI", name: "Michigan", stateTaxRate: 0.06, confidence: "low",
    tradeInCredit: cap(9000), docFeeCap: dollars(260), typicalDocFee: dollars(260),
    titleFee: dollars(15), registrationFee: dollars(200),
    notes:
      "Trade-in credit is capped and the cap steps up annually under a phase-in schedule — this figure goes stale " +
      "every January. Doc fee cap is the greater of a flat amount or a percentage of price; only the flat cap is modeled.",
  }),
  MN: defineState({
    code: "MN", name: "Minnesota", stateTaxRate: 0.06875, confidence: "medium",
    tradeInCredit: FULL, docFeeCap: dollars(125), typicalDocFee: dollars(125),
    titleFee: dollars(9), registrationFee: dollars(250),
  }),
  MS: defineState({
    code: "MS", name: "Mississippi", stateTaxRate: 0.05, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(9), registrationFee: dollars(120),
  }),
  MO: defineState({
    code: "MO", name: "Missouri", stateTaxRate: 0.04225, confidence: "medium",
    typicalLocalTaxRate: 0.035, maxLocalTaxRate: 0.058, tradeInCredit: FULL,
    titleFee: dollars(11), registrationFee: dollars(150),
  }),
  MT: defineState({
    code: "MT", name: "Montana", stateTaxRate: 0, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(12), registrationFee: dollars(217),
    notes: "No sales tax. A luxury vehicle fee applies above a price threshold; not modeled.",
  }),
  NE: defineState({
    code: "NE", name: "Nebraska", stateTaxRate: 0.055, confidence: "medium",
    typicalLocalTaxRate: 0.015, maxLocalTaxRate: 0.02, tradeInCredit: FULL,
    titleFee: dollars(10), registrationFee: dollars(150),
  }),
  NV: defineState({
    code: "NV", name: "Nevada", stateTaxRate: 0.046, confidence: "medium",
    typicalLocalTaxRate: 0.036, maxLocalTaxRate: 0.0415, tradeInCredit: FULL,
    docFeeCap: dollars(499), typicalDocFee: dollars(499),
    titleFee: dollars(29), registrationFee: dollars(300),
    notes: "Government Services Tax is assessed separately on depreciated value and is not modeled here.",
  }),
  NH: defineState({
    code: "NH", name: "New Hampshire", stateTaxRate: 0, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(25), registrationFee: dollars(150),
    notes: "No sales tax. Municipal registration permit fees are value-based and vary by town.",
  }),
  NJ: defineState({
    code: "NJ", name: "New Jersey", stateTaxRate: 0.06625, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(60), registrationFee: dollars(85),
    notes: "A luxury/gas-guzzler surcharge applies above a price threshold; not modeled.",
  }),
  NM: defineState({
    code: "NM", name: "New Mexico", stateTaxRate: 0.04, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(17), registrationFee: dollars(90),
    notes: "Motor vehicle excise tax, levied in place of gross receipts tax on vehicle sales.",
  }),
  NY: defineState({
    code: "NY", name: "New York", stateTaxRate: 0.04, confidence: "high",
    typicalLocalTaxRate: 0.045, maxLocalTaxRate: 0.0488, tradeInCredit: FULL,
    docFeeCap: dollars(175), typicalDocFee: dollars(175),
    titleFee: dollars(50), registrationFee: dollars(140),
    leaseTaxBasis: "total_of_payments_upfront",
    notes:
      "Leases are taxed on the ENTIRE total of payments at inception, not per month — the single biggest lease-quoting " +
      "trap in the country. Local rates vary widely; NYC is materially higher than the typical figure here.",
  }),
  NC: defineState({
    code: "NC", name: "North Carolina", stateTaxRate: 0.03, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(56), registrationFee: dollars(38),
    notes: "Highway Use Tax rather than sales tax. A maximum applies to certain vehicle classes.",
  }),
  ND: defineState({
    code: "ND", name: "North Dakota", stateTaxRate: 0.05, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(5), registrationFee: dollars(120),
    notes: "Motor vehicle excise tax.",
  }),
  OH: defineState({
    code: "OH", name: "Ohio", stateTaxRate: 0.0575, confidence: "medium",
    typicalLocalTaxRate: 0.015, maxLocalTaxRate: 0.0225, tradeInCredit: FULL,
    docFeeCap: dollars(250), typicalDocFee: dollars(250),
    titleFee: dollars(15), registrationFee: dollars(80),
    notes: "Doc fee cap is the greater of a flat amount or a percentage of price; only the flat cap is modeled.",
  }),
  OK: defineState({
    code: "OK", name: "Oklahoma", stateTaxRate: 0.0125, confidence: "low",
    tradeInCredit: FULL, titleFee: dollars(11), registrationFee: dollars(96),
    notes:
      "A reduced sales tax rate applies alongside a separate excise tax on the vehicle. Only the sales tax portion is " +
      "modeled — add the excise as a fee line until this is properly implemented.",
  }),
  OR: defineState({
    code: "OR", name: "Oregon", stateTaxRate: 0.005, confidence: "medium",
    tradeInCredit: NONE, titleFee: dollars(101), registrationFee: dollars(268),
    notes: "No general sales tax. A vehicle privilege tax applies to new vehicle sales on the full price.",
  }),
  PA: defineState({
    code: "PA", name: "Pennsylvania", stateTaxRate: 0.06, confidence: "high",
    typicalLocalTaxRate: 0, maxLocalTaxRate: 0.02, tradeInCredit: FULL,
    titleFee: dollars(58), registrationFee: dollars(45),
    notes: "Allegheny County and Philadelphia add local rates — set the override for those ZIPs.",
  }),
  RI: defineState({
    code: "RI", name: "Rhode Island", stateTaxRate: 0.07, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(53), registrationFee: dollars(60),
  }),
  SC: defineState({
    code: "SC", name: "South Carolina", stateTaxRate: 0.05, confidence: "low",
    tradeInCredit: FULL, titleFee: dollars(15), registrationFee: dollars(40),
    notes:
      "The Infrastructure Maintenance Fee replaces sales tax and is CAPPED at a flat maximum per vehicle. " +
      "The cap is not yet modeled — the engine will overstate tax on anything but an inexpensive car. Fix before use.",
  }),
  SD: defineState({
    code: "SD", name: "South Dakota", stateTaxRate: 0.04, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(10), registrationFee: dollars(120),
    notes: "Motor vehicle excise tax.",
  }),
  TN: defineState({
    code: "TN", name: "Tennessee", stateTaxRate: 0.07, confidence: "low",
    typicalLocalTaxRate: 0.025, maxLocalTaxRate: 0.0275, tradeInCredit: FULL,
    titleFee: dollars(11), registrationFee: dollars(100),
    notes:
      "Local tax applies only to the first portion of the price, and a separate single-article tax applies above it. " +
      "Neither bracket is modeled — local tax will be overstated on most deals. Fix before use.",
  }),
  TX: defineState({
    code: "TX", name: "Texas", stateTaxRate: 0.0625, confidence: "high",
    tradeInCredit: FULL, titleFee: dollars(33), registrationFee: dollars(80),
    leaseTaxBasis: "full_price_upfront", leaseTradeCredit: true,
    notes:
      "Flat 6.25% motor vehicle sales tax with no local add-on — one of the cleanest states to model. " +
      "Leases are taxed upfront on the full vehicle price, not per payment. No doc fee cap.",
  }),
  UT: defineState({
    code: "UT", name: "Utah", stateTaxRate: 0.0485, confidence: "medium",
    typicalLocalTaxRate: 0.022, maxLocalTaxRate: 0.033, tradeInCredit: FULL,
    titleFee: dollars(6), registrationFee: dollars(150),
  }),
  VT: defineState({
    code: "VT", name: "Vermont", stateTaxRate: 0.06, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(35), registrationFee: dollars(76),
    notes: "Purchase and use tax.",
  }),
  VA: defineState({
    code: "VA", name: "Virginia", stateTaxRate: 0.0415, confidence: "medium",
    tradeInCredit: NONE, titleFee: dollars(15), registrationFee: dollars(85),
    notes: "Motor vehicle Sales and Use Tax with a statutory minimum per vehicle. The minimum is not modeled.",
  }),
  WA: defineState({
    code: "WA", name: "Washington", stateTaxRate: 0.065, confidence: "medium",
    typicalLocalTaxRate: 0.026, maxLocalTaxRate: 0.041, tradeInCredit: FULL,
    titleFee: dollars(15), registrationFee: dollars(200),
    notes: "An additional motor vehicle excise applies on top of sales tax; add it as a fee line until modeled.",
  }),
  WV: defineState({
    code: "WV", name: "West Virginia", stateTaxRate: 0.06, confidence: "medium",
    tradeInCredit: FULL, titleFee: dollars(15), registrationFee: dollars(52),
    notes: "Motor vehicle privilege tax.",
  }),
  WI: defineState({
    code: "WI", name: "Wisconsin", stateTaxRate: 0.05, confidence: "medium",
    typicalLocalTaxRate: 0.005, maxLocalTaxRate: 0.017, tradeInCredit: FULL,
    titleFee: dollars(165), registrationFee: dollars(85),
  }),
  WY: defineState({
    code: "WY", name: "Wyoming", stateTaxRate: 0.04, confidence: "medium",
    typicalLocalTaxRate: 0.015, maxLocalTaxRate: 0.02, tradeInCredit: FULL,
    titleFee: dollars(15), registrationFee: dollars(90),
  }),
};

export const STATE_LIST: StateRule[] = Object.values(STATE_RULES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function getStateRule(code: StateCode): StateRule {
  return STATE_RULES[code];
}

/** States whose figures a human should confirm before quoting a live customer. */
export function statesNeedingReview(): StateRule[] {
  return STATE_LIST.filter((s) => !s.verified);
}

/** States where the flat-rate model is a known approximation of a different regime. */
export function statesWithApproximatedRegime(): StateRule[] {
  return STATE_LIST.filter((s) => s.confidence === "low");
}
