import { DEFAULT_FI_MENU } from "./fiProducts";
import { LENDER_PROGRAMS } from "./lenders";
import { getStateRule } from "./states";
import { defaultFees } from "@/lib/desking/fees";
import { ZERO, dollars } from "@/lib/desking/money";
import type { DealInput, DealType, LeaseTerms, StateCode } from "@/lib/desking/types";

/** Lease defaults that are reasonable for a new vehicle before a program is chosen. */
export function defaultLeaseTerms(): LeaseTerms {
  return {
    termMonths: 36,
    annualMileage: 12000,
    residualPercent: 0.58,
    moneyFactor: 0.00145,
    baseMoneyFactor: 0.00115,
    acquisitionFee: dollars(895),
    capitalizeAcquisitionFee: true,
    dispositionFee: dollars(395),
    residualMileageAdjustment: 0,
  };
}

/**
 * A fresh deal, pre-populated with the selected state's fee defaults.
 *
 * The vehicle here is a placeholder so the grid has something to render on first
 * load. Cost and pack are set to realistic values so the gross panel isn't a
 * meaningless number.
 */
export function createDefaultDeal(
  state: StateCode = "TX",
  dealType: DealType = "finance",
): DealInput {
  const rule = getStateRule(state);
  const captive = LENDER_PROGRAMS.find((p) => p.id === "captive-tier-a")!;

  return {
    dealType,
    state,
    localTaxRateOverride: null,
    vehicle: {
      year: 2026,
      make: "Placeholder",
      model: "Sedan",
      trim: "SEL",
      condition: "new",
      mileage: 12,
      stockNumber: "N26001",
      msrp: dollars(38995),
      invoice: dollars(36100),
      cost: dollars(36100),
      pack: dollars(795),
    },
    sellingPrice: dollars(37495),
    trade: null,
    cashDown: dollars(3000),
    rebates: ZERO,
    fees: defaultFees(rule),
    fiProducts: DEFAULT_FI_MENU.map((p) => ({ ...p })),
    term: 72,
    sellRate: captive.buyRate + 0.01,
    buyRate: captive.buyRate,
    reserve: captive.reserve,
    balloonResidualPercent: 0.45,
    lease: defaultLeaseTerms(),
    dealerCash: ZERO,
  };
}
