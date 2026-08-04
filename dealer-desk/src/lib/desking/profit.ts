import { presentValue } from "./amortization";
import { ZERO, add, atLeastZero, max, mul, sub, type Cents } from "./money";
import type { DealInput, ProfitBreakdown, ReserveStructure, Trade } from "./types";

/**
 * Gross profit.
 *
 * The number the desk actually optimizes for, and the one the customer never
 * sees. Two things here are easy to get wrong and both cost real money:
 *
 * 1. Over-allowance. Showing a customer $18,000 for a trade worth $15,500 is a
 *    $2,500 hole in front gross, not a marketing expense. It is charged here.
 * 2. Reserve on a rate spread. The dealer does not earn "the difference in
 *    payments" — they earn the present value of that difference at the buy rate,
 *    which is meaningfully less on a long term.
 */

/** Money given away above the trade's real value. Always a front-gross charge. */
export function overAllowance(trade: Trade | null): Cents {
  if (!trade) return ZERO;
  return atLeastZero(sub(trade.allowance, trade.actualCashValue));
}

export function tradeEquity(trade: Trade | null): Cents {
  if (!trade) return ZERO;
  return sub(trade.allowance, trade.payoff);
}

/** Profit on selected F&I products: retail less dealer cost. */
export function fiProductGross(input: DealInput): Cents {
  let total = ZERO;
  for (const product of input.fiProducts) {
    if (!product.selected) continue;
    total = add(total, sub(product.price, product.cost));
  }
  return total;
}

/**
 * Finance reserve.
 *
 * `rate_spread` values the spread properly: what the lender will fund the
 * customer's payment stream for at the buy rate, less what was actually
 * financed. `flat_percent` is the simple flat-fee structure many subprime and
 * credit union programs use instead.
 */
export function computeReserve(
  structure: ReserveStructure,
  amountFinanced: Cents,
  monthlyPayment: Cents,
  buyRate: number,
  term: number,
): Cents {
  switch (structure.kind) {
    case "none":
      return ZERO;
    case "flat_percent":
      return mul(amountFinanced, structure.percent);
    case "rate_spread": {
      const fundedAtBuyRate = presentValue(monthlyPayment, buyRate, term);
      const spread = atLeastZero(sub(fundedAtBuyRate, amountFinanced));
      return mul(spread, structure.dealerSharePercent);
    }
  }
}

/**
 * Lease reserve from money factor markup.
 *
 * Marking a money factor up by 0.00025 earns the rent-charge difference across
 * the whole term, on (adjusted cap cost + residual) — not on the cap cost alone.
 */
export function computeLeaseReserve(
  moneyFactor: number,
  baseMoneyFactor: number,
  adjustedCapCost: Cents,
  residual: Cents,
  term: number,
  dealerSharePercent: number,
): Cents {
  const markup = Math.max(0, moneyFactor - baseMoneyFactor);
  if (markup === 0) return ZERO;
  const perMonth = mul(add(adjustedCapCost, residual), markup);
  return mul(mul(perMonth, term), dealerSharePercent);
}

export function computeProfit(
  input: DealInput,
  amountFinanced: Cents,
  monthlyPayment: Cents,
  term: number,
  /** Supplied by the lease engine, which earns reserve on MF markup instead of rate spread. */
  reserveOverride?: Cents,
): ProfitBreakdown {
  const front = sub(
    sub(sub(input.sellingPrice, input.vehicle.cost), input.vehicle.pack),
    overAllowance(input.trade),
  );

  const fi = fiProductGross(input);
  const reserve =
    reserveOverride ??
    computeReserve(input.reserve, amountFinanced, monthlyPayment, input.buyRate, term);
  const back = add(fi, reserve);

  return {
    frontGross: front,
    backGross: back,
    fiProductGross: fi,
    reserve,
    dealerCash: input.dealerCash,
    totalGross: add(add(front, back), input.dealerCash),
  };
}

/** Front gross with the pack added back, which is how most pay plans compute commission. */
export function commissionableGross(profit: ProfitBreakdown, pack: Cents): Cents {
  return max(ZERO, add(profit.frontGross, pack));
}
