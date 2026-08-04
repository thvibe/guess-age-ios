/**
 * Money is always integer cents. Never a float.
 *
 * A desking calculator that drifts a penny across a 72-month amortization is a
 * calculator a desk manager stops trusting, and trust is the whole product. All
 * arithmetic here is integer-based; the only place floats are permitted is rate
 * math (APR, money factor), where the result is immediately rounded back to cents.
 */

/** Integer cents. Branded so a raw number can't be passed where money is expected. */
export type Cents = number & { readonly __brand: "Cents" };

export const ZERO = 0 as Cents;

/** Construct cents from a whole-dollar or fractional-dollar amount. */
export function dollars(amount: number): Cents {
  if (!Number.isFinite(amount)) return ZERO;
  return Math.round(amount * 100) as Cents;
}

/** Construct cents from an already-integer cent value. */
export function cents(value: number): Cents {
  if (!Number.isFinite(value)) return ZERO;
  return Math.round(value) as Cents;
}

export function toDollars(value: Cents): number {
  return value / 100;
}

export function add(...values: Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total as Cents;
}

export function sub(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

export function neg(a: Cents): Cents {
  return -a as Cents;
}

export function abs(a: Cents): Cents {
  return Math.abs(a) as Cents;
}

/** Multiply money by a unitless factor (a rate, a percentage, a count). */
export function mul(value: Cents, factor: number): Cents {
  if (!Number.isFinite(factor)) return ZERO;
  return Math.round(value * factor) as Cents;
}

/** Divide money by a unitless divisor. */
export function div(value: Cents, divisor: number): Cents {
  if (!Number.isFinite(divisor) || divisor === 0) return ZERO;
  return Math.round(value / divisor) as Cents;
}

/** Clamp to zero — used wherever a negative amount is nonsensical (e.g. a taxable base). */
export function atLeastZero(value: Cents): Cents {
  return (value < 0 ? 0 : value) as Cents;
}

export function min(a: Cents, b: Cents): Cents {
  return (a < b ? a : b) as Cents;
}

export function max(a: Cents, b: Cents): Cents {
  return (a > b ? a : b) as Cents;
}

export function isZero(value: Cents): boolean {
  return value === 0;
}

/**
 * Apply a cap that may be absent. Used for doc fee caps, which most states
 * don't have at all.
 */
export function capped(value: Cents, cap: Cents | null): Cents {
  return cap === null ? value : min(value, cap);
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(value: Cents): string {
  return USD.format(toDollars(value));
}

/** Whole-dollar format for grid cells, where two decimals is visual noise. */
export function formatMoneyWhole(value: Cents): string {
  return USD_WHOLE.format(toDollars(value));
}

/** Signed format — leading +/- so equity direction reads at a glance. */
export function formatSigned(value: Cents): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}${USD.format(Math.abs(toDollars(value)))}`;
}

export function formatPercent(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Parse loose user input ("$28,450.00", "28450") into cents. */
export function parseMoney(input: string): Cents {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return ZERO;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? dollars(parsed) : ZERO;
}
