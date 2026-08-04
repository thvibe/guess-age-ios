import type { Cents } from "@/lib/desking/money";
import type {
  CreditTier,
  DealType,
  Incentive,
  LenderProgram,
  StateCode,
  VehicleCondition,
} from "@/lib/desking/types";

/**
 * Provider interfaces for the three external data sources this product will
 * eventually depend on: lender rate sheets, OEM incentives, and insurance quotes.
 *
 * None of them are wired to a live feed today, and that is a deliberate choice.
 * Rate and incentive data comes from contract-gated vendors (Chrome Data,
 * DataOne, MarketScan, RouteOne) with long onboarding cycles. Rather than block
 * the calculator on a signed contract, every provider is an interface with a
 * manual implementation behind it. When a real feed lands it implements the same
 * interface and gets swapped in at the registry — no engine changes, no UI
 * changes.
 *
 * `isLive` is exposed so the UI can honestly label where a number came from. A
 * desk manager should always be able to tell a real published rate from a figure
 * their own GM typed in last month.
 */

export interface Provider {
  readonly id: string;
  readonly name: string;
  /** False when the data is dealer-entered rather than fetched from a vendor. */
  readonly isLive: boolean;
  /** ISO timestamp of the last successful refresh, or null for manual sources. */
  readonly lastSyncedAt: string | null;
}

export interface RateQuery {
  dealType: DealType;
  state: StateCode;
  creditScore: number;
  term: number;
  vehicleCondition: VehicleCondition;
  vehicleYear: number;
}

export interface RateProvider extends Provider {
  listPrograms(query: RateQuery): Promise<LenderProgram[]>;
  tierForScore(score: number): CreditTier;
}

export interface IncentiveQuery {
  state: StateCode;
  make: string;
  model: string;
  year: number;
  dealType: DealType;
  /** Filters loyalty/conquest/military/college offers the customer qualifies for. */
  eligibilityFlags: string[];
}

export interface IncentiveProvider extends Provider {
  listIncentives(query: IncentiveQuery): Promise<Incentive[]>;
}

export interface InsuranceQuoteRequest {
  state: StateCode;
  zip: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  driverAge: number;
  /** Whether the deal requires full coverage, as most lenders do. */
  fullCoverageRequired: boolean;
}

export interface InsuranceQuote {
  carrier: string;
  monthlyPremium: Cents;
  sixMonthPremium: Cents;
  liabilityLimits: string;
  deductible: Cents;
  quoteUrl: string | null;
}

export interface InsuranceProvider extends Provider {
  quote(request: InsuranceQuoteRequest): Promise<InsuranceQuote[]>;
}

/**
 * Thrown when a provider is referenced but has no live integration configured.
 * Callers should catch this and degrade gracefully rather than surfacing an
 * error — an unconfigured insurance provider is the expected state today.
 */
export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string, detail: string) {
    super(`${providerName} is not configured. ${detail}`);
    this.name = "ProviderNotConfiguredError";
  }
}
