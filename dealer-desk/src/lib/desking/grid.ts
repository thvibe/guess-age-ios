import { calculate, type CalcOptions } from "./calculate";
import type { Cents } from "./money";
import type { DealInput, Quote } from "./types";

/**
 * The payment grid — terms across one axis, cash down across the other.
 *
 * This is the view a desk manager actually works in. They don't want one
 * payment, they want the shape of the deal: what happens at 72 vs 84, at $2,000
 * down vs $5,000, and where the customer's number lives on that surface.
 *
 * Because `calculate` is pure, the grid is just that function over a matrix.
 */

export interface GridAxes {
  terms: number[];
  downPayments: Cents[];
}

export interface GridCell {
  term: number;
  cashDown: Cents;
  quote: Quote;
}

export const DEFAULT_TERMS = [36, 48, 60, 72, 84];
export const DEFAULT_LEASE_TERMS = [24, 27, 36, 39, 42, 48];

/** Rows are terms, columns are down payments. */
export function buildPaymentGrid(
  input: DealInput,
  axes: GridAxes,
  options: CalcOptions = {},
): GridCell[][] {
  return axes.terms.map((term) =>
    axes.downPayments.map((cashDown) => {
      const variant: DealInput = {
        ...input,
        term,
        cashDown,
        lease: input.lease ? { ...input.lease, termMonths: term } : null,
      };
      return { term, cashDown, quote: calculate(variant, options) };
    }),
  );
}

/**
 * Find the cell closest to a target monthly payment.
 *
 * The everyday desking question is "the customer said $600" — this answers it
 * across the whole grid instead of making someone scan for it.
 */
export function closestToPayment(
  grid: GridCell[][],
  target: Cents,
): GridCell | null {
  let best: GridCell | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of grid) {
    for (const cell of row) {
      const delta = Math.abs(cell.quote.monthlyPayment - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = cell;
      }
    }
  }
  return best;
}

/** Cells that carry a blocking lender or compliance warning. */
export function blockedCells(grid: GridCell[][]): GridCell[] {
  return grid
    .flat()
    .filter((cell) => cell.quote.warnings.some((w) => w.level === "block"));
}
