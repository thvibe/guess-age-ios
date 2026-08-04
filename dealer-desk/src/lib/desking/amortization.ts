import { ZERO, cents, div, mul, sub, type Cents } from "./money";

/**
 * Pure amortization math. No deal concepts here — just principal, rate, term.
 *
 * Rates enter as annual decimals (0.0699 for 6.99% APR) and are converted to a
 * monthly periodic rate internally. Every return value is rounded to whole cents
 * at the boundary so downstream money math stays integral.
 */

export function monthlyRate(apr: number): number {
  return apr / 12;
}

/**
 * Level monthly payment that fully amortizes `principal` over `term` months.
 * A zero rate degrades to simple division rather than dividing by zero.
 */
export function payment(principal: Cents, apr: number, term: number): Cents {
  if (term <= 0) return ZERO;
  const r = monthlyRate(apr);
  if (r === 0) return div(principal, term);
  const factor = r / (1 - Math.pow(1 + r, -term));
  return mul(principal, factor);
}

/**
 * Payment that amortizes `principal` down to `balloon` (rather than to zero)
 * over `term` months. Balloon retail and residual-based contracts use this.
 */
export function paymentWithBalloon(
  principal: Cents,
  apr: number,
  term: number,
  balloon: Cents,
): Cents {
  if (term <= 0) return ZERO;
  const r = monthlyRate(apr);
  if (r === 0) return div(sub(principal, balloon), term);
  const discountedBalloon = principal - balloon * Math.pow(1 + r, -term);
  const factor = r / (1 - Math.pow(1 + r, -term));
  return cents(discountedBalloon * factor);
}

/** Present value of a level payment stream discounted at `apr`. */
export function presentValue(pmt: Cents, apr: number, term: number): Cents {
  if (term <= 0) return ZERO;
  const r = monthlyRate(apr);
  if (r === 0) return mul(pmt, term);
  return mul(pmt, (1 - Math.pow(1 + r, -term)) / r);
}

/** Outstanding balance after `elapsed` payments. */
export function remainingBalance(
  principal: Cents,
  apr: number,
  term: number,
  elapsed: number,
): Cents {
  if (elapsed >= term) return ZERO;
  const r = monthlyRate(apr);
  const pmt = payment(principal, apr, term);
  if (r === 0) return sub(principal, mul(pmt, elapsed));
  const grown = principal * Math.pow(1 + r, elapsed);
  const paid = (pmt * (Math.pow(1 + r, elapsed) - 1)) / r;
  return cents(grown - paid);
}

/**
 * Solve for the APR that produces `pmt` on `principal` over `term`.
 *
 * Bisection rather than Newton: the payment function is monotonic in rate over
 * the bracket, and bisection cannot diverge on the degenerate inputs a desk
 * throws at it (zero principal, payment below interest-only, etc.).
 */
export function solveApr(principal: Cents, pmt: Cents, term: number): number {
  if (principal <= 0 || pmt <= 0 || term <= 0) return 0;
  // A payment that never retires the principal has no solution in the bracket.
  if (pmt * term <= principal) return 0;

  let low = 0;
  let high = 1.5; // 150% APR is far beyond any lender program.
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (payment(principal, mid, term) > pmt) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export interface AmortizationRow {
  period: number;
  payment: Cents;
  interest: Cents;
  principal: Cents;
  balance: Cents;
}

/**
 * Full amortization schedule. The final row absorbs rounding drift so the
 * balance lands exactly on the target (zero, or the balloon amount).
 */
export function schedule(
  principal: Cents,
  apr: number,
  term: number,
  endingBalance: Cents = ZERO,
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  if (term <= 0) return rows;

  const r = monthlyRate(apr);
  const pmt =
    endingBalance > 0
      ? paymentWithBalloon(principal, apr, term, endingBalance)
      : payment(principal, apr, term);

  let balance = principal;
  for (let period = 1; period <= term; period += 1) {
    const interest = mul(balance, r);
    let principalPortion = sub(pmt, interest);
    let thisPayment = pmt;

    if (period === term) {
      // Settle any accumulated rounding into the last payment.
      principalPortion = sub(balance, endingBalance);
      thisPayment = cents(principalPortion + interest);
    }

    balance = sub(balance, principalPortion);
    rows.push({
      period,
      payment: thisPayment,
      interest,
      principal: principalPortion,
      balance,
    });
  }
  return rows;
}
