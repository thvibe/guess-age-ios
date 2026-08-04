import type { Cents } from "./money";

/** The four deal structures a desk writes. */
export type DealType = "finance" | "lease" | "cash" | "balloon";

export type StateCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "DC" | "FL"
  | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME"
  | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH"
  | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI"
  | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

// ---------------------------------------------------------------------------
// State rules
// ---------------------------------------------------------------------------

/**
 * How a state treats trade-in value when computing sales tax. This single field
 * is worth thousands of dollars on a deal and is the most common source of a
 * wrong payment.
 */
export type TradeInCredit =
  /** Tax the selling price less the full trade allowance. Most states. */
  | { kind: "full" }
  /** Tax the full selling price; the trade doesn't reduce the base. CA, MI (historically), others. */
  | { kind: "none" }
  /** Trade credit allowed up to a ceiling. */
  | { kind: "capped"; max: Cents };

/**
 * When lease tax is assessed and on what base. Lease taxation is the least
 * portable part of desking — NY taxes the total of payments upfront, most
 * states tax each monthly payment, a few tax the full vehicle price.
 */
export type LeaseTaxBasis =
  /** Tax added to each monthly payment. The common case. */
  | "monthly_payment"
  /** Entire lease's payment stream taxed at inception (NY, and similar). */
  | "total_of_payments_upfront"
  /** Tax on the full vehicle selling price at inception (TX-style). */
  | "full_price_upfront"
  /** Tax on capitalized cost at inception. */
  | "cap_cost_upfront";

/**
 * How confident this record's *numbers* are, distinct from whether a human has
 * signed off. Structural rules (does the state allow trade credit?) are far more
 * stable than fee schedules, which change by legislative session.
 */
export type Confidence = "high" | "medium" | "low";

export interface StateRule {
  code: StateCode;
  name: string;
  /** Statewide base sales/use tax rate applied to vehicles, as a decimal. */
  stateTaxRate: number;
  /** Typical additional local/county/district rate. A starting point, always overridable. */
  typicalLocalTaxRate: number;
  /** Highest combined local add-on observed, used to warn on override entry. */
  maxLocalTaxRate: number;
  tradeInCredit: TradeInCredit;
  /**
   * True when a manufacturer rebate reduces the taxable base. False means the
   * customer pays tax on the pre-rebate price.
   */
  rebateReducesTaxableBase: boolean;
  /** Statutory doc fee ceiling, or null where the state doesn't cap it. */
  docFeeCap: Cents | null;
  /** What dealers in this state commonly charge, as a default. */
  typicalDocFee: Cents;
  docFeeTaxable: boolean;
  titleFee: Cents;
  registrationFee: Cents;
  plateFee: Cents;
  /** Whether VSC / GAP / other F&I products are subject to sales tax. */
  fiProductsTaxable: boolean;
  leaseTaxBasis: LeaseTaxBasis;
  /** Whether a trade reduces the lease tax base. */
  leaseTradeCredit: boolean;
  notes?: string;
  /** True only once a human has confirmed these figures against the statute. */
  verified: boolean;
  confidence: Confidence;
  /** ISO date the figures were last touched. */
  asOf: string;
}

// ---------------------------------------------------------------------------
// Deal components
// ---------------------------------------------------------------------------

export type VehicleCondition = "new" | "used" | "cpo";

export interface Vehicle {
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  condition: VehicleCondition;
  mileage: number;
  stockNumber?: string;
  msrp: Cents;
  invoice?: Cents;
  /** Dealer cost. Drives front gross — never shown to the customer. */
  cost: Cents;
  /** Dealer pack held back before front gross is credited to the salesperson. */
  pack: Cents;
}

export interface Trade {
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  /** What the customer is shown. */
  allowance: Cents;
  /** Actual cash value — what the trade is really worth. Overallowance eats front gross. */
  actualCashValue: Cents;
  /** Outstanding loan balance on the trade. */
  payoff: Cents;
}

export type FiCategory =
  | "vsc"
  | "gap"
  | "maintenance"
  | "appearance"
  | "tire_wheel"
  | "key_replacement"
  | "theft"
  | "other";

export interface FiProduct {
  id: string;
  name: string;
  category: FiCategory;
  /** Retail price presented to the customer. */
  price: Cents;
  /** Dealer cost. price − cost is back gross. */
  cost: Cents;
  /** Rolled into the amount financed vs. collected in cash. */
  capitalized: boolean;
  /** Null defers to the state's default F&I taxability. */
  taxableOverride: boolean | null;
  selected: boolean;
}

export type FeeKind =
  | "doc"
  | "title"
  | "registration"
  | "plate"
  | "electronic_filing"
  | "smog"
  | "tire"
  | "lien"
  | "dealer"
  | "other";

export interface Fee {
  id: string;
  label: string;
  kind: FeeKind;
  amount: Cents;
  taxable: boolean;
  /** Financed vs. due in cash at signing. */
  capitalized: boolean;
  /** Whether the state's doc fee cap applies to this line. */
  subjectToDocCap: boolean;
}

// ---------------------------------------------------------------------------
// Lender programs and incentives
// ---------------------------------------------------------------------------

export type CreditTier = "S" | "A" | "B" | "C" | "D" | "E";

/**
 * How the dealer earns finance reserve. Flat percent of amount financed is the
 * simple case; rate spread pays a share of the present-value difference between
 * the buy rate and the rate the customer actually signs.
 */
export type ReserveStructure =
  | { kind: "none" }
  | { kind: "flat_percent"; percent: number }
  | { kind: "rate_spread"; dealerSharePercent: number };

export interface LenderProgram {
  id: string;
  lenderName: string;
  programName: string;
  dealTypes: DealType[];
  creditTier: CreditTier;
  minScore: number;
  maxScore: number;
  /** Finance/balloon: the lender's buy rate as a decimal APR. */
  buyRate: number;
  /** Lease: the lender's base money factor. */
  baseMoneyFactor: number;
  /** Maximum APR markup permitted over buy rate. */
  maxRateMarkup: number;
  /** Maximum money factor markup permitted over base. */
  maxMoneyFactorMarkup: number;
  reserve: ReserveStructure;
  availableTerms: number[];
  /** Max advance as a fraction of collateral value (LTV ceiling). */
  maxAdvancePercent: number;
  /** Max financeable back-end (F&I products) this lender will accept. */
  maxBackEnd: Cents;
  acquisitionFee: Cents;
  minAmountFinanced: Cents;
  maxAmountFinanced: Cents;
}

export type IncentiveKind =
  | "customer_cash"
  | "dealer_cash"
  | "subvented_apr"
  | "subvented_money_factor"
  | "lease_cash"
  | "loyalty"
  | "conquest"
  | "military"
  | "college";

export interface Incentive {
  id: string;
  name: string;
  kind: IncentiveKind;
  amount: Cents;
  /** For subvented programs: the buydown APR or money factor. */
  subventedRate: number | null;
  /** Terms the subvented rate is valid for. */
  eligibleTerms: number[];
  dealTypes: DealType[];
  /** Whether this incentive can combine with others. */
  stackable: boolean;
  /** Dealer cash never touches the customer's numbers — it's pure front gross. */
  customerFacing: boolean;
  expiresOn: string | null;
  source: string;
}

// ---------------------------------------------------------------------------
// Deal input
// ---------------------------------------------------------------------------

export interface LeaseTerms {
  termMonths: number;
  annualMileage: number;
  /** Residual as a fraction of MSRP. */
  residualPercent: number;
  /** The money factor the customer signs (base + markup). */
  moneyFactor: number;
  baseMoneyFactor: number;
  acquisitionFee: Cents;
  capitalizeAcquisitionFee: boolean;
  dispositionFee: Cents;
  /** Mileage adjustment applied to the residual, as a fraction of MSRP. */
  residualMileageAdjustment: number;
}

export interface DealInput {
  dealType: DealType;
  state: StateCode;
  /** Overrides the state record's typical local rate when the ZIP is known. */
  localTaxRateOverride: number | null;
  vehicle: Vehicle;
  sellingPrice: Cents;
  trade: Trade | null;
  cashDown: Cents;
  /** Customer-facing rebates applied to the deal. */
  rebates: Cents;
  fees: Fee[];
  fiProducts: FiProduct[];
  /** Finance and balloon. */
  term: number;
  /** APR the customer signs. */
  sellRate: number;
  /** Lender's buy rate — the spread is reserve. */
  buyRate: number;
  reserve: ReserveStructure;
  /** Balloon only: final balance as a fraction of MSRP. */
  balloonResidualPercent: number;
  lease: LeaseTerms | null;
  /** Dealer cash and other non-customer-facing money. */
  dealerCash: Cents;
}

// ---------------------------------------------------------------------------
// Quote output
// ---------------------------------------------------------------------------

export interface TaxBreakdown {
  /** The base the tax rate was applied to, after all state-specific reductions. */
  taxableBase: Cents;
  effectiveRate: number;
  stateTax: Cents;
  localTax: Cents;
  total: Cents;
  /** Populated for leases taxed per-payment rather than upfront. */
  monthlyTax: Cents;
  /** Human-readable trail of how the base was derived. Shown in the UI. */
  explanation: string[];
}

export interface FeeBreakdown {
  capitalized: Cents;
  dueAtSigning: Cents;
  total: Cents;
  /** Amount trimmed to respect the state doc fee cap, if any. */
  docFeeAdjustment: Cents;
}

export interface TradeBreakdown {
  allowance: Cents;
  payoff: Cents;
  /** allowance − payoff. Negative means the customer is upside down. */
  equity: Cents;
  /** allowance − ACV. Money given away above real value; reduces front gross. */
  overAllowance: Cents;
  /** Portion of negative equity rolled into the new loan. */
  negativeEquityFinanced: Cents;
}

export interface ProfitBreakdown {
  /** Selling price − vehicle cost − pack − overallowance. */
  frontGross: Cents;
  /** F&I product profit + finance reserve. */
  backGross: Cents;
  fiProductGross: Cents;
  reserve: Cents;
  dealerCash: Cents;
  /** frontGross + backGross + dealerCash. */
  totalGross: Cents;
}

export type WarningLevel = "info" | "warn" | "block";

export interface DealWarning {
  level: WarningLevel;
  code: string;
  message: string;
}

export interface Quote {
  dealType: DealType;
  term: number;
  monthlyPayment: Cents;
  /** Lease payment before tax, where tax is charged per payment. */
  basePayment: Cents;
  amountFinanced: Cents;
  totalOfPayments: Cents;
  financeCharge: Cents;
  apr: number;
  /** Balloon/lease: the balance or residual owed at the end. */
  residual: Cents;
  dueAtSigning: Cents;
  cashDown: Cents;
  taxes: TaxBreakdown;
  fees: FeeBreakdown;
  trade: TradeBreakdown;
  profit: ProfitBreakdown;
  warnings: DealWarning[];
}
