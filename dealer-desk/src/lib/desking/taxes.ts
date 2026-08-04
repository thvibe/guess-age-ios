import {
  ZERO,
  add,
  atLeastZero,
  dollars,
  formatMoney,
  formatPercent,
  min,
  mul,
  sub,
  type Cents,
} from "./money";
import type { DealInput, StateRule, TaxBreakdown } from "./types";

/**
 * Sales/use tax computation.
 *
 * The taxable base — not the rate — is where desking calculators get it wrong.
 * Every reduction below is state-conditional, and each one is recorded in an
 * `explanation` trail so a desk manager can see exactly how the number was
 * reached rather than being asked to trust it.
 */

/** Florida's discretionary county surtax applies only to the first $5,000 of the base. */
const FL_SURTAX_BASE_CAP = dollars(5000);

function effectiveLocalRate(input: DealInput, rule: StateRule): number {
  return input.localTaxRateOverride ?? rule.typicalLocalTaxRate;
}

/** Sum of fee lines the state treats as taxable. */
export function taxableFeeTotal(input: DealInput, rule: StateRule): Cents {
  let total = ZERO;
  for (const fee of input.fees) {
    const taxable = fee.kind === "doc" ? rule.docFeeTaxable && fee.taxable : fee.taxable;
    if (taxable) total = add(total, fee.amount);
  }
  return total;
}

/** Sum of selected F&I products the state treats as taxable. */
export function taxableFiTotal(input: DealInput, rule: StateRule): Cents {
  let total = ZERO;
  for (const product of input.fiProducts) {
    if (!product.selected) continue;
    const taxable = product.taxableOverride ?? rule.fiProductsTaxable;
    if (taxable) total = add(total, product.price);
  }
  return total;
}

/**
 * Retail (finance / cash / balloon) tax.
 *
 * Order of operations matters: rebate first, then trade credit, then clamp to
 * zero, then add taxable fees and F&I. Adding fees before the clamp would let a
 * large trade wash out tax on fees that are separately taxable.
 */
export function computeRetailTax(input: DealInput, rule: StateRule): TaxBreakdown {
  const explanation: string[] = [];
  let base = input.sellingPrice;
  explanation.push(`Selling price ${formatMoney(base)}`);

  if (input.rebates > 0) {
    if (rule.rebateReducesTaxableBase) {
      base = sub(base, input.rebates);
      explanation.push(`− Rebates ${formatMoney(input.rebates)} (${rule.code} taxes after rebate)`);
    } else {
      explanation.push(`Rebates ${formatMoney(input.rebates)} NOT deducted — ${rule.code} taxes the pre-rebate price`);
    }
  }

  const trade = input.trade;
  if (trade && trade.allowance > 0) {
    switch (rule.tradeInCredit.kind) {
      case "full":
        base = sub(base, trade.allowance);
        explanation.push(`− Trade allowance ${formatMoney(trade.allowance)} (full credit)`);
        break;
      case "capped": {
        const credit = min(trade.allowance, rule.tradeInCredit.max);
        base = sub(base, credit);
        explanation.push(
          `− Trade credit ${formatMoney(credit)} (capped at ${formatMoney(rule.tradeInCredit.max)})`,
        );
        break;
      }
      case "none":
        explanation.push(
          `Trade allowance ${formatMoney(trade.allowance)} gives NO tax credit in ${rule.code}`,
        );
        break;
    }
  }

  base = atLeastZero(base);

  const fees = taxableFeeTotal(input, rule);
  if (fees > 0) {
    base = add(base, fees);
    explanation.push(`+ Taxable fees ${formatMoney(fees)}`);
  }

  const fi = taxableFiTotal(input, rule);
  if (fi > 0) {
    base = add(base, fi);
    explanation.push(`+ Taxable F&I products ${formatMoney(fi)}`);
  }

  const localRate = effectiveLocalRate(input, rule);
  const stateTax = mul(base, rule.stateTaxRate);

  // Florida caps the county surtax base; everywhere else the local rate applies
  // to the whole base.
  const localBase = rule.code === "FL" ? min(base, FL_SURTAX_BASE_CAP) : base;
  const localTax = mul(localBase, localRate);

  if (rule.code === "FL" && base > FL_SURTAX_BASE_CAP && localRate > 0) {
    explanation.push(
      `County surtax applies only to the first ${formatMoney(FL_SURTAX_BASE_CAP)} of the base`,
    );
  }

  explanation.push(
    `Taxable base ${formatMoney(base)} × ${formatPercent(rule.stateTaxRate + localRate, 3)}`,
  );

  return {
    taxableBase: base,
    effectiveRate: rule.stateTaxRate + localRate,
    stateTax,
    localTax,
    total: add(stateTax, localTax),
    monthlyTax: ZERO,
    explanation,
  };
}

export interface LeaseTaxContext {
  /** Pre-tax monthly payment (depreciation + rent charge). */
  basePayment: Cents;
  termMonths: number;
  /** Cash down, rebates, and trade equity applied as cap cost reduction. */
  capCostReduction: Cents;
  /** Adjusted capitalized cost, for states taxing at inception on cap cost. */
  adjustedCapCost: Cents;
}

/**
 * Lease tax.
 *
 * Four regimes, and they produce wildly different numbers on the same car:
 * most states tax each monthly payment; New York taxes the entire payment
 * stream at signing; Texas taxes the full vehicle price at signing.
 *
 * The monthly tax is deliberately NOT capitalized — it rides on top of the base
 * payment. Capitalizing it would make the payment depend on itself.
 */
export function computeLeaseTax(
  input: DealInput,
  rule: StateRule,
  ctx: LeaseTaxContext,
): TaxBreakdown {
  const explanation: string[] = [];
  const localRate = effectiveLocalRate(input, rule);
  const rate = rule.stateTaxRate + localRate;

  const split = (total: Cents) => {
    if (rate === 0) return { stateTax: ZERO, localTax: ZERO };
    return {
      stateTax: mul(total, rule.stateTaxRate / rate),
      localTax: mul(total, localRate / rate),
    };
  };

  switch (rule.leaseTaxBasis) {
    case "monthly_payment": {
      const monthlyTax = mul(ctx.basePayment, rate);
      // Cap cost reduction is taxed at inception in most per-payment states.
      const upfront = mul(ctx.capCostReduction, rate);
      explanation.push(
        `Monthly payment ${formatMoney(ctx.basePayment)} × ${formatPercent(rate, 3)} = ${formatMoney(monthlyTax)}/mo`,
      );
      if (ctx.capCostReduction > 0) {
        explanation.push(
          `Cap cost reduction ${formatMoney(ctx.capCostReduction)} taxed at signing = ${formatMoney(upfront)}`,
        );
      }
      const totalOverTerm = add(mul(monthlyTax, ctx.termMonths), upfront);
      return {
        taxableBase: ctx.basePayment,
        effectiveRate: rate,
        ...split(totalOverTerm),
        total: upfront,
        monthlyTax,
        explanation,
      };
    }

    case "total_of_payments_upfront": {
      const base = add(mul(ctx.basePayment, ctx.termMonths), ctx.capCostReduction);
      const total = mul(base, rate);
      explanation.push(
        `${rule.code} taxes the ENTIRE lease at signing: ` +
          `(${formatMoney(ctx.basePayment)} × ${ctx.termMonths}) + cap reduction ${formatMoney(ctx.capCostReduction)}`,
      );
      explanation.push(`Taxable base ${formatMoney(base)} × ${formatPercent(rate, 3)}`);
      return {
        taxableBase: base,
        effectiveRate: rate,
        ...split(total),
        total,
        monthlyTax: ZERO,
        explanation,
      };
    }

    case "full_price_upfront": {
      let base = input.sellingPrice;
      explanation.push(`${rule.code} taxes the full vehicle price at inception`);
      if (rule.leaseTradeCredit && input.trade && input.trade.allowance > 0) {
        base = atLeastZero(sub(base, input.trade.allowance));
        explanation.push(`− Trade allowance ${formatMoney(input.trade.allowance)}`);
      }
      const total = mul(base, rate);
      explanation.push(`Taxable base ${formatMoney(base)} × ${formatPercent(rate, 3)}`);
      return {
        taxableBase: base,
        effectiveRate: rate,
        ...split(total),
        total,
        monthlyTax: ZERO,
        explanation,
      };
    }

    case "cap_cost_upfront": {
      const base = ctx.adjustedCapCost;
      const total = mul(base, rate);
      explanation.push(
        `${rule.code} taxes adjusted capitalized cost ${formatMoney(base)} at inception`,
      );
      return {
        taxableBase: base,
        effectiveRate: rate,
        ...split(total),
        total,
        monthlyTax: ZERO,
        explanation,
      };
    }
  }
}
