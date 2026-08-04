import { SEED_INCENTIVES } from "@/data/incentives";
import { LENDER_PROGRAMS, tierForScore } from "@/data/lenders";
import type { Incentive, LenderProgram } from "@/lib/desking/types";
import {
  ProviderNotConfiguredError,
  type IncentiveProvider,
  type IncentiveQuery,
  type InsuranceProvider,
  type InsuranceQuote,
  type InsuranceQuoteRequest,
  type RateProvider,
  type RateQuery,
} from "./types";

/**
 * Manual (dealer-entered) implementations of every provider interface.
 *
 * This is the honest default: the dealer's own rate sheets and program
 * bulletins, entered by a human, clearly labelled as such. It is what ships
 * until a vendor contract is signed.
 */

export class ManualRateProvider implements RateProvider {
  readonly id = "manual-rates";
  readonly name = "Dealer rate sheet";
  readonly isLive = false;
  readonly lastSyncedAt = null;

  private programs: LenderProgram[];

  constructor(programs: LenderProgram[] = LENDER_PROGRAMS) {
    this.programs = programs;
  }

  tierForScore(score: number) {
    return tierForScore(score);
  }

  async listPrograms(query: RateQuery): Promise<LenderProgram[]> {
    return this.programs
      .filter((p) => p.dealTypes.includes(query.dealType))
      .filter((p) => query.creditScore >= p.minScore && query.creditScore <= p.maxScore)
      .filter((p) => p.availableTerms.includes(query.term));
  }
}

export class ManualIncentiveProvider implements IncentiveProvider {
  readonly id = "manual-incentives";
  readonly name = "Manually entered bulletins";
  readonly isLive = false;
  readonly lastSyncedAt = null;

  private incentives: Incentive[];

  constructor(incentives: Incentive[] = SEED_INCENTIVES) {
    this.incentives = incentives;
  }

  async listIncentives(query: IncentiveQuery): Promise<Incentive[]> {
    return this.incentives.filter((i) => i.dealTypes.includes(query.dealType));
  }
}

/**
 * Insurance quoting placeholder.
 *
 * Deliberately throws rather than returning fabricated premiums. A made-up
 * insurance quote shown to a customer is worse than no quote at all, and the
 * calling UI is expected to catch this and render an "not connected" state.
 */
export class UnconfiguredInsuranceProvider implements InsuranceProvider {
  readonly id = "insurance-unconfigured";
  readonly name = "Insurance quoting";
  readonly isLive = false;
  readonly lastSyncedAt = null;

  async quote(_request: InsuranceQuoteRequest): Promise<InsuranceQuote[]> {
    throw new ProviderNotConfiguredError(
      this.name,
      "No insurance partner is connected. Implement InsuranceProvider against a partner API and register it to enable in-deal quoting.",
    );
  }
}
