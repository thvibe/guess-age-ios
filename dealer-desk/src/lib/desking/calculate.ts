import { payment, paymentWithBalloon } from "./amortization";
import { getStateRule } from "@/data/states";
import { summarizeFees } from "./fees";
import {
  ZERO,
  abs,
  add,
  atLeastZero,
  formatMoney,
  formatPercent,
  mul,
  sub,
  type Cents,
} from "./money";
import {
  computeLeaseReserve,
  computeProfit,
  overAllowance,
  tradeEquity,
} from "./profit";
import { computeLeaseTax, computeRetailTax } from "./taxes";
import type {
  DealInput,
  DealWarning,
  LenderProgram,
  Quote,
  StateRule,
  TradeBreakdown,
} from "./types";

/**
 * The deal engine. One entry point, four structures.
 *
 * Everything upstream of this file is pure data; everything downstream is
 * presentation. `calculate` is deterministic and side-effect free, which is what
 * makes the payment grid cheap — it's just this function run across a matrix.
 */

export interface CalcOptions {
  /** Enables lender-guideline warnings (LTV, back-end caps, markup limits, terms). */
  lender?: LenderProgram;
}

/** Money the customer brings that reduces what's financed or capitalized. */
function capitalizedFiTotal(input: DealInput): Cents {
  let total = ZERO;
  for (const p of input.fiProducts) {
    if (p.selected && p.capitalized) total = add(total, p.price);
  }
  return total;
}

function cashFiTotal(input: DealInput): Cents {
  let total = ZERO;
  for (const p of input.fiProducts) {
    if (p.selected && !p.capitalized) total = add(total, p.price);
  }
  return total;
}

function buildTradeBreakdown(input: DealInput): TradeBreakdown {
  const trade = input.trade;
  if (!trade) {
    return {
      allowance: ZERO,
      payoff: ZERO,
      equity: ZERO,
      overAllowance: ZERO,
      negativeEquityFinanced: ZERO,
    };
  }
  const equity = tradeEquity(trade);
  return {
    allowance: trade.allowance,
    payoff: trade.payoff,
    equity,
    overAllowance: overAllowance(trade),
    negativeEquityFinanced: equity < 0 ? abs(equity) : ZERO,
  };
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

function stateWarnings(rule: StateRule): DealWarning[] {
  const warnings: DealWarning[] = [];
  if (!rule.verified) {
    warnings.push({
      level: "info",
      code: "STATE_UNVERIFIED",
      message: `${rule.name} tax and fee figures have not been human-verified. Confirm before quoting a live customer.`,
    });
  }
  if (rule.confidence === "low") {
    warnings.push({
      level: "warn",
      code: "STATE_APPROXIMATED",
      message: `${rule.name} uses a tax regime this engine only approximates. ${rule.notes ?? ""}`.trim(),
    });
  }
  return warnings;
}

function lenderWarnings(
  input: DealInput,
  amountFinanced: Cents,
  lender: LenderProgram | undefined,
): DealWarning[] {
  const warnings: DealWarning[] = [];
  if (!lender) return warnings;

  if (!lender.availableTerms.includes(input.term)) {
    warnings.push({
      level: "warn",
      code: "TERM_UNAVAILABLE",
      message: `${lender.lenderName} does not offer ${input.term} months on ${lender.programName}.`,
    });
  }

  const collateral = input.vehicle.condition === "new" ? input.vehicle.msrp : input.sellingPrice;
  const maxAdvance = mul(collateral, lender.maxAdvancePercent);
  if (amountFinanced > maxAdvance) {
    warnings.push({
      level: "block",
      code: "LTV_EXCEEDED",
      message:
        `Amount financed ${formatMoney(amountFinanced)} exceeds ${lender.lenderName}'s ` +
        `${formatPercent(lender.maxAdvancePercent, 0)} advance limit of ${formatMoney(maxAdvance)}.`,
    });
  }

  const backEnd = capitalizedFiTotal(input);
  if (backEnd > lender.maxBackEnd) {
    warnings.push({
      level: "block",
      code: "BACKEND_EXCEEDED",
      message:
        `Financed back-end ${formatMoney(backEnd)} exceeds ${lender.lenderName}'s ` +
        `limit of ${formatMoney(lender.maxBackEnd)}.`,
    });
  }

  if (amountFinanced < lender.minAmountFinanced) {
    warnings.push({
      level: "warn",
      code: "BELOW_MIN_ADVANCE",
      message: `Amount financed is below ${lender.lenderName}'s minimum of ${formatMoney(lender.minAmountFinanced)}.`,
    });
  }

  if (amountFinanced > lender.maxAmountFinanced) {
    warnings.push({
      level: "block",
      code: "ABOVE_MAX_ADVANCE",
      message: `Amount financed exceeds ${lender.lenderName}'s maximum of ${formatMoney(lender.maxAmountFinanced)}.`,
    });
  }

  return warnings;
}

function rateWarnings(input: DealInput): DealWarning[] {
  const warnings: DealWarning[] = [];
  if (input.dealType === "lease") return warnings;

  if (input.sellRate < input.buyRate) {
    warnings.push({
      level: "warn",
      code: "RATE_BELOW_BUY",
      message:
        `Sell rate ${formatPercent(input.sellRate)} is below the buy rate ` +
        `${formatPercent(input.buyRate)} — the dealer is buying the rate down out of gross.`,
    });
  }
  return warnings;
}

function feeWarnings(docFeeAdjustment: Cents, rule: StateRule): DealWarning[] {
  if (docFeeAdjustment <= 0) return [];
  return [
    {
      level: "warn",
      code: "DOC_FEE_CAPPED",
      message:
        `Doc fee trimmed by ${formatMoney(docFeeAdjustment)} to meet ${rule.name}'s ` +
        `${formatMoney(rule.docFeeCap!)} statutory cap.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Retail: finance, cash, balloon
// ---------------------------------------------------------------------------

function calculateRetail(input: DealInput, options: CalcOptions): Quote {
  const rule = getStateRule(input.state);
  const fees = summarizeFees(input, rule);
  const taxes = computeRetailTax(input, rule);
  const trade = buildTradeBreakdown(input);

  const capFi = capitalizedFiTotal(input);
  const cashFi = cashFiTotal(input);

  // Cash deals collect tax and every fee at delivery rather than financing them.
  const isCash = input.dealType === "cash";

  const financedTax = isCash ? ZERO : taxes.total;
  const financedFees = isCash ? ZERO : fees.capitalized;
  const financedFi = isCash ? ZERO : capFi;

  // Positive equity reduces the advance; negative equity rolls into it. A single
  // subtraction handles both directions. A cash deal finances nothing at all —
  // the whole balance is collected at delivery.
  const amountFinanced = isCash
    ? ZERO
    : atLeastZero(
        sub(
          add(input.sellingPrice, financedTax, financedFees, financedFi),
          add(input.cashDown, input.rebates, trade.equity),
        ),
      );

  const residual =
    input.dealType === "balloon"
      ? mul(input.vehicle.msrp, input.balloonResidualPercent)
      : ZERO;

  let monthlyPayment = ZERO;
  if (!isCash) {
    monthlyPayment =
      input.dealType === "balloon"
        ? paymentWithBalloon(amountFinanced, input.sellRate, input.term, residual)
        : payment(amountFinanced, input.sellRate, input.term);
  }

  const totalOfPayments = isCash ? ZERO : add(mul(monthlyPayment, input.term), residual);
  const financeCharge = isCash ? ZERO : atLeastZero(sub(totalOfPayments, amountFinanced));

  const dueAtSigning = isCash
    ? atLeastZero(
        sub(
          add(input.sellingPrice, taxes.total, fees.total, add(capFi, cashFi)),
          add(input.rebates, trade.equity),
        ),
      )
    : add(input.cashDown, fees.dueAtSigning, cashFi);

  const profit = computeProfit(input, amountFinanced, monthlyPayment, input.term);

  const warnings: DealWarning[] = [
    ...stateWarnings(rule),
    ...feeWarnings(fees.docFeeAdjustment, rule),
    ...rateWarnings(input),
    ...lenderWarnings(input, amountFinanced, options.lender),
  ];

  if (trade.negativeEquityFinanced > 0) {
    warnings.push({
      level: "info",
      code: "NEGATIVE_EQUITY",
      message: `${formatMoney(trade.negativeEquityFinanced)} of negative equity is rolled into this deal.`,
    });
  }

  return {
    dealType: input.dealType,
    term: isCash ? 0 : input.term,
    monthlyPayment,
    basePayment: monthlyPayment,
    amountFinanced,
    totalOfPayments,
    financeCharge,
    apr: isCash ? 0 : input.sellRate,
    residual,
    dueAtSigning,
    cashDown: input.cashDown,
    taxes,
    fees,
    trade,
    profit,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Lease
// ---------------------------------------------------------------------------

function calculateLease(input: DealInput, options: CalcOptions): Quote {
  const rule = getStateRule(input.state);
  const lease = input.lease;
  if (!lease) throw new Error("Lease terms are required for a lease deal.");

  const fees = summarizeFees(input, rule);
  const trade = buildTradeBreakdown(input);
  const capFi = capitalizedFiTotal(input);
  const cashFi = cashFiTotal(input);

  const acqInCap = lease.capitalizeAcquisitionFee ? lease.acquisitionFee : ZERO;
  const grossCapCost = add(input.sellingPrice, fees.capitalized, capFi, acqInCap);

  // Cap cost reduction is customer money down; negative equity works the other way.
  const capCostReduction = add(
    input.cashDown,
    input.rebates,
    atLeastZero(trade.equity),
  );
  const adjustedCapCost = atLeastZero(
    add(sub(grossCapCost, capCostReduction), trade.negativeEquityFinanced),
  );

  const residualPercent = lease.residualPercent + lease.residualMileageAdjustment;
  const residual = mul(input.vehicle.msrp, residualPercent);

  const depreciation =
    lease.termMonths > 0
      ? mul(sub(adjustedCapCost, residual), 1 / lease.termMonths)
      : ZERO;
  const rentCharge = mul(add(adjustedCapCost, residual), lease.moneyFactor);
  const basePayment = atLeastZero(add(depreciation, rentCharge));

  const taxes = computeLeaseTax(input, rule, {
    basePayment,
    termMonths: lease.termMonths,
    capCostReduction,
    adjustedCapCost,
  });

  const monthlyPayment = add(basePayment, taxes.monthlyTax);
  const totalOfPayments = mul(monthlyPayment, lease.termMonths);

  const dueAtSigning = add(
    input.cashDown,
    fees.dueAtSigning,
    cashFi,
    lease.capitalizeAcquisitionFee ? ZERO : lease.acquisitionFee,
    taxes.total,
    monthlyPayment, // first payment collected at signing
  );

  const dealerShare =
    input.reserve.kind === "rate_spread" ? input.reserve.dealerSharePercent : 1;
  const leaseReserve = computeLeaseReserve(
    lease.moneyFactor,
    lease.baseMoneyFactor,
    adjustedCapCost,
    residual,
    lease.termMonths,
    dealerShare,
  );

  const profit = computeProfit(
    input,
    adjustedCapCost,
    monthlyPayment,
    lease.termMonths,
    leaseReserve,
  );

  const warnings: DealWarning[] = [
    ...stateWarnings(rule),
    ...feeWarnings(fees.docFeeAdjustment, rule),
    ...lenderWarnings(input, adjustedCapCost, options.lender),
  ];

  const mfMarkup = lease.moneyFactor - lease.baseMoneyFactor;
  if (options.lender && mfMarkup > options.lender.maxMoneyFactorMarkup) {
    warnings.push({
      level: "block",
      code: "MF_MARKUP_EXCEEDED",
      message:
        `Money factor markup of ${mfMarkup.toFixed(5)} exceeds ` +
        `${options.lender.lenderName}'s limit of ${options.lender.maxMoneyFactorMarkup.toFixed(5)}.`,
    });
  }

  if (rule.leaseTaxBasis === "total_of_payments_upfront") {
    warnings.push({
      level: "info",
      code: "LEASE_TAX_UPFRONT",
      message: `${rule.name} taxes the entire lease at signing — ${formatMoney(taxes.total)} is due up front.`,
    });
  }

  return {
    dealType: "lease",
    term: lease.termMonths,
    monthlyPayment,
    basePayment,
    amountFinanced: adjustedCapCost,
    totalOfPayments,
    financeCharge: mul(rentCharge, lease.termMonths),
    // The industry's 2400 rule gives APR as a percentage (MF × 2400 = 3.48%).
    // `apr` is a decimal everywhere else in the quote, so the factor is 24.
    apr: lease.moneyFactor * 24,
    residual,
    dueAtSigning,
    cashDown: input.cashDown,
    taxes,
    fees,
    trade,
    profit,
    warnings,
  };
}

// ---------------------------------------------------------------------------

export function calculate(input: DealInput, options: CalcOptions = {}): Quote {
  return input.dealType === "lease"
    ? calculateLease(input, options)
    : calculateRetail(input, options);
}
