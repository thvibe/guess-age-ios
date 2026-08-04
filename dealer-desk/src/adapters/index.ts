import {
  ManualIncentiveProvider,
  ManualRateProvider,
  UnconfiguredInsuranceProvider,
} from "./manual";
import type { IncentiveProvider, InsuranceProvider, RateProvider } from "./types";

export * from "./types";
export * from "./manual";

/**
 * The single place providers are bound.
 *
 * Connecting a real feed is a change to this file and nothing else: implement
 * the interface, construct it here, done. The engine and UI are unaware of which
 * implementation is active beyond the `isLive` flag they use to label sources.
 */
export interface ProviderRegistry {
  rates: RateProvider;
  incentives: IncentiveProvider;
  insurance: InsuranceProvider;
}

export const providers: ProviderRegistry = {
  rates: new ManualRateProvider(),
  incentives: new ManualIncentiveProvider(),
  insurance: new UnconfiguredInsuranceProvider(),
};

/** True when every data source is dealer-entered — drives the UI's provenance banner. */
export function allSourcesManual(registry: ProviderRegistry = providers): boolean {
  return !registry.rates.isLive && !registry.incentives.isLive;
}
