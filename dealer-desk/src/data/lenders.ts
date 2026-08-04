import { dollars } from "@/lib/desking/money";
import type { CreditTier, LenderProgram } from "@/lib/desking/types";

/**
 * Seed lender programs.
 *
 * These are plausible, structurally-correct placeholders — NOT any real
 * lender's published rate sheet. They exist so the calculator has something to
 * work against before a rate feed is connected, and so the tier/markup/reserve
 * plumbing is exercised end to end. Every field is dealer-editable.
 */

function program(seed: Partial<LenderProgram> & Pick<LenderProgram, "id" | "lenderName" | "programName" | "creditTier" | "buyRate" | "minScore" | "maxScore">): LenderProgram {
  return {
    dealTypes: ["finance", "balloon"],
    baseMoneyFactor: 0.00125,
    maxRateMarkup: 0.02,
    maxMoneyFactorMarkup: 0.0004,
    reserve: { kind: "rate_spread", dealerSharePercent: 0.75 },
    availableTerms: [36, 48, 60, 72, 84],
    maxAdvancePercent: 1.2,
    maxBackEnd: dollars(6000),
    acquisitionFee: dollars(0),
    minAmountFinanced: dollars(5000),
    maxAmountFinanced: dollars(150000),
    ...seed,
  };
}

export const LENDER_PROGRAMS: LenderProgram[] = [
  program({
    id: "cu-tier-s",
    lenderName: "Regional Credit Union",
    programName: "Super Prime Auto",
    creditTier: "S",
    minScore: 780,
    maxScore: 850,
    buyRate: 0.0499,
    maxRateMarkup: 0.0125,
    reserve: { kind: "flat_percent", percent: 0.01 },
    maxAdvancePercent: 1.3,
  }),
  program({
    id: "captive-tier-a",
    lenderName: "Captive Finance",
    programName: "Tier A Retail",
    creditTier: "A",
    minScore: 720,
    maxScore: 779,
    buyRate: 0.0629,
    baseMoneyFactor: 0.00115,
    dealTypes: ["finance", "lease", "balloon"],
    acquisitionFee: dollars(895),
    maxAdvancePercent: 1.25,
  }),
  program({
    id: "bank-tier-b",
    lenderName: "National Bank Auto",
    programName: "Tier B Retail",
    creditTier: "B",
    minScore: 660,
    maxScore: 719,
    buyRate: 0.0849,
    maxAdvancePercent: 1.15,
    maxBackEnd: dollars(5000),
  }),
  program({
    id: "bank-tier-c",
    lenderName: "National Bank Auto",
    programName: "Tier C Retail",
    creditTier: "C",
    minScore: 600,
    maxScore: 659,
    buyRate: 0.1249,
    availableTerms: [36, 48, 60, 72],
    maxAdvancePercent: 1.1,
    maxBackEnd: dollars(3500),
  }),
  program({
    id: "subprime-tier-d",
    lenderName: "Second Chance Acceptance",
    programName: "Subprime Retail",
    creditTier: "D",
    minScore: 520,
    maxScore: 599,
    buyRate: 0.1899,
    availableTerms: [36, 48, 60, 66],
    reserve: { kind: "flat_percent", percent: 0.0 },
    maxAdvancePercent: 1.0,
    maxBackEnd: dollars(2500),
    maxAmountFinanced: dollars(45000),
  }),
];

export function tierForScore(score: number): CreditTier {
  if (score >= 780) return "S";
  if (score >= 720) return "A";
  if (score >= 660) return "B";
  if (score >= 600) return "C";
  if (score >= 520) return "D";
  return "E";
}

export function programsForScore(score: number): LenderProgram[] {
  return LENDER_PROGRAMS.filter((p) => score >= p.minScore && score <= p.maxScore);
}
