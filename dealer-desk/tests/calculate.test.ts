import { describe, expect, it } from "vitest";
import { createDefaultDeal, defaultLeaseTerms } from "@/data/defaultDeal";
import { LENDER_PROGRAMS } from "@/data/lenders";
import { STATE_RULES, getStateRule } from "@/data/states";
import { calculate } from "@/lib/desking/calculate";
import { dollars, toDollars } from "@/lib/desking/money";
import type { DealInput, StateCode, Trade } from "@/lib/desking/types";

function deal(state: StateCode = "TX", overrides: Partial<DealInput> = {}): DealInput {
  return { ...createDefaultDeal(state), localTaxRateOverride: 0, ...overrides };
}

describe("finance", () => {
  it("produces a positive payment and a sane amount financed", () => {
    const quote = calculate(deal("TX"));
    expect(quote.monthlyPayment).toBeGreaterThan(0);
    expect(quote.amountFinanced).toBeGreaterThan(0);
    expect(quote.totalOfPayments).toBeGreaterThan(quote.amountFinanced);
  });

  it("finance charge equals total of payments less amount financed", () => {
    const quote = calculate(deal("TX"));
    expect(quote.financeCharge).toBe(quote.totalOfPayments - quote.amountFinanced);
  });

  it("more cash down means a lower payment", () => {
    const low = calculate(deal("TX", { cashDown: dollars(1000) }));
    const high = calculate(deal("TX", { cashDown: dollars(8000) }));
    expect(high.monthlyPayment).toBeLessThan(low.monthlyPayment);
  });

  it("capitalizes tax and fees into the amount financed", () => {
    const withFees = calculate(deal("TX"));
    const noFees = calculate(deal("TX", { fees: [] }));
    expect(withFees.amountFinanced).toBeGreaterThan(noFees.amountFinanced);
  });

  it("positive trade equity reduces the amount financed", () => {
    const trade: Trade = {
      allowance: dollars(12000),
      actualCashValue: dollars(12000),
      payoff: dollars(4000),
    };
    const withTrade = calculate(deal("TX", { trade }));
    const without = calculate(deal("TX"));
    expect(withTrade.amountFinanced).toBeLessThan(without.amountFinanced);
    expect(withTrade.trade.equity).toBe(dollars(8000));
  });

  it("rolls negative equity into the loan and flags it", () => {
    const trade: Trade = {
      allowance: dollars(8000),
      actualCashValue: dollars(8000),
      payoff: dollars(14000),
    };
    const quote = calculate(deal("TX", { trade }));
    expect(quote.trade.equity).toBe(dollars(-6000));
    expect(quote.trade.negativeEquityFinanced).toBe(dollars(6000));
    expect(quote.warnings.some((w) => w.code === "NEGATIVE_EQUITY")).toBe(true);
  });

  it("never returns a negative amount financed", () => {
    const trade: Trade = {
      allowance: dollars(90000),
      actualCashValue: dollars(90000),
      payoff: dollars(0),
    };
    const quote = calculate(deal("TX", { trade, cashDown: dollars(20000) }));
    expect(quote.amountFinanced).toBe(0);
  });
});

describe("cash", () => {
  it("has no payment, no term, and no finance charge", () => {
    const quote = calculate(deal("TX", { dealType: "cash" }));
    expect(quote.monthlyPayment).toBe(0);
    expect(quote.term).toBe(0);
    expect(quote.financeCharge).toBe(0);
    expect(quote.amountFinanced).toBe(0);
  });

  it("collects price, tax, and every fee at delivery", () => {
    const quote = calculate(deal("TX", { dealType: "cash" }));
    expect(quote.dueAtSigning).toBeGreaterThan(dollars(37495));
  });

  it("still earns front gross", () => {
    const quote = calculate(deal("TX", { dealType: "cash" }));
    expect(quote.profit.frontGross).toBeGreaterThan(0);
    expect(quote.profit.reserve).toBe(0);
  });
});

describe("balloon", () => {
  it("is cheaper monthly than the equivalent finance deal", () => {
    const finance = calculate(deal("TX", { dealType: "finance", term: 60 }));
    const balloon = calculate(deal("TX", { dealType: "balloon", term: 60 }));
    expect(balloon.monthlyPayment).toBeLessThan(finance.monthlyPayment);
  });

  it("reports a residual balance owed at the end", () => {
    const quote = calculate(deal("TX", { dealType: "balloon", balloonResidualPercent: 0.45 }));
    expect(toDollars(quote.residual)).toBeCloseTo(38995 * 0.45, 0);
  });

  it("includes the residual in the total of payments", () => {
    const quote = calculate(deal("TX", { dealType: "balloon" }));
    expect(quote.totalOfPayments).toBeGreaterThan(quote.residual);
  });
});

describe("lease", () => {
  it("produces a payment lower than financing the same car", () => {
    const finance = calculate(deal("TX", { dealType: "finance", term: 36 }));
    const lease = calculate(deal("TX", { dealType: "lease" }));
    expect(lease.monthlyPayment).toBeLessThan(finance.monthlyPayment);
  });

  it("converts money factor to an equivalent APR with the 2400 rule", () => {
    const quote = calculate(deal("TX", { dealType: "lease" }));
    // MF 0.00145 → 3.48% APR, expressed as a decimal like every other rate.
    expect(quote.apr).toBeCloseTo(0.0348, 6);
    expect(quote.apr).toBeLessThan(0.25);
  });

  it("a higher residual lowers the payment", () => {
    const low = calculate(
      deal("TX", { dealType: "lease", lease: { ...defaultLeaseTerms(), residualPercent: 0.5 } }),
    );
    const high = calculate(
      deal("TX", { dealType: "lease", lease: { ...defaultLeaseTerms(), residualPercent: 0.65 } }),
    );
    expect(high.monthlyPayment).toBeLessThan(low.monthlyPayment);
  });

  it("earns reserve from money factor markup", () => {
    const marked = calculate(deal("TX", { dealType: "lease" }));
    const flat = calculate(
      deal("TX", {
        dealType: "lease",
        lease: { ...defaultLeaseTerms(), moneyFactor: 0.00115, baseMoneyFactor: 0.00115 },
      }),
    );
    expect(marked.profit.reserve).toBeGreaterThan(0);
    expect(flat.profit.reserve).toBe(0);
  });

  it("blocks a money factor markup beyond the lender's limit", () => {
    const captive = LENDER_PROGRAMS.find((p) => p.id === "captive-tier-a")!;
    const quote = calculate(
      deal("TX", {
        dealType: "lease",
        lease: { ...defaultLeaseTerms(), moneyFactor: 0.005, baseMoneyFactor: 0.00115 },
      }),
      { lender: captive },
    );
    expect(quote.warnings.some((w) => w.code === "MF_MARKUP_EXCEEDED" && w.level === "block")).toBe(
      true,
    );
  });
});

describe("lease taxation by state", () => {
  it("New York charges the entire lease tax at signing", () => {
    const quote = calculate(deal("NY", { dealType: "lease", localTaxRateOverride: 0.045 }));
    expect(getStateRule("NY").leaseTaxBasis).toBe("total_of_payments_upfront");
    expect(quote.taxes.monthlyTax).toBe(0);
    expect(quote.taxes.total).toBeGreaterThan(0);
    expect(quote.warnings.some((w) => w.code === "LEASE_TAX_UPFRONT")).toBe(true);
  });

  it("Texas taxes the full vehicle price at inception, not the payment", () => {
    const quote = calculate(deal("TX", { dealType: "lease" }));
    expect(quote.taxes.monthlyTax).toBe(0);
    expect(toDollars(quote.taxes.taxableBase)).toBe(37495);
  });

  it("a per-payment state adds tax on top of the base payment", () => {
    const quote = calculate(deal("FL", { dealType: "lease", localTaxRateOverride: 0 }));
    expect(getStateRule("FL").leaseTaxBasis).toBe("monthly_payment");
    expect(quote.taxes.monthlyTax).toBeGreaterThan(0);
    expect(quote.monthlyPayment).toBe(quote.basePayment + quote.taxes.monthlyTax);
  });

  it("New York's upfront lease tax lands in due-at-signing", () => {
    const ny = calculate(deal("NY", { dealType: "lease", localTaxRateOverride: 0.045 }));
    const fl = calculate(deal("FL", { dealType: "lease", localTaxRateOverride: 0.01 }));
    expect(ny.dueAtSigning).toBeGreaterThan(fl.dueAtSigning);
  });
});

describe("doc fee caps", () => {
  it("trims a doc fee above California's cap and says so", () => {
    const input = deal("CA");
    const overCap: DealInput = {
      ...input,
      fees: input.fees.map((f) =>
        f.kind === "doc" ? { ...f, amount: dollars(799) } : f,
      ),
    };
    const quote = calculate(overCap);
    expect(quote.fees.docFeeAdjustment).toBe(dollars(799) - dollars(85));
    expect(quote.warnings.some((w) => w.code === "DOC_FEE_CAPPED")).toBe(true);
  });

  it("leaves the doc fee alone in a state with no cap", () => {
    const input = deal("TX");
    const high: DealInput = {
      ...input,
      fees: input.fees.map((f) => (f.kind === "doc" ? { ...f, amount: dollars(799) } : f)),
    };
    const quote = calculate(high);
    expect(quote.fees.docFeeAdjustment).toBe(0);
  });
});

describe("profit", () => {
  it("charges over-allowance against front gross", () => {
    const honest: Trade = {
      allowance: dollars(15000),
      actualCashValue: dollars(15000),
      payoff: dollars(0),
    };
    const inflated: Trade = {
      allowance: dollars(18000),
      actualCashValue: dollars(15000),
      payoff: dollars(0),
    };
    const a = calculate(deal("TX", { trade: honest }));
    const b = calculate(deal("TX", { trade: inflated }));
    expect(b.profit.frontGross).toBe(a.profit.frontGross - dollars(3000));
    expect(b.trade.overAllowance).toBe(dollars(3000));
  });

  it("counts selected F&I products in back gross only", () => {
    const input = deal("TX");
    const withVsc: DealInput = {
      ...input,
      fiProducts: input.fiProducts.map((p) =>
        p.id === "vsc" ? { ...p, selected: true } : p,
      ),
    };
    const base = calculate(input);
    const sold = calculate(withVsc);
    // $2,495 retail − $1,150 cost
    expect(sold.profit.fiProductGross - base.profit.fiProductGross).toBe(dollars(1345));
    expect(sold.profit.frontGross).toBe(base.profit.frontGross);
  });

  it("earns no reserve when the sell rate equals the buy rate", () => {
    const quote = calculate(deal("TX", { sellRate: 0.0629, buyRate: 0.0629 }));
    expect(quote.profit.reserve).toBe(0);
  });

  it("earns reserve on a rate spread and more of it on a longer term", () => {
    const short = calculate(deal("TX", { term: 36 }));
    const long = calculate(deal("TX", { term: 84 }));
    expect(short.profit.reserve).toBeGreaterThan(0);
    expect(long.profit.reserve).toBeGreaterThan(short.profit.reserve);
  });

  it("adds dealer cash to total gross without touching the customer's payment", () => {
    const without = calculate(deal("TX"));
    const withCash = calculate(deal("TX", { dealerCash: dollars(1000) }));
    expect(withCash.monthlyPayment).toBe(without.monthlyPayment);
    expect(withCash.profit.totalGross).toBe(without.profit.totalGross + dollars(1000));
  });

  it("total gross is the sum of its parts", () => {
    const q = calculate(deal("TX", { dealerCash: dollars(500) }));
    expect(q.profit.totalGross).toBe(
      q.profit.frontGross + q.profit.backGross + q.profit.dealerCash,
    );
    expect(q.profit.backGross).toBe(q.profit.fiProductGross + q.profit.reserve);
  });
});

describe("lender guideline warnings", () => {
  const subprime = LENDER_PROGRAMS.find((p) => p.id === "subprime-tier-d")!;

  it("blocks when the advance exceeds the LTV ceiling", () => {
    const quote = calculate(
      deal("TX", { cashDown: dollars(0), sellingPrice: dollars(44000) }),
      { lender: subprime },
    );
    expect(quote.warnings.some((w) => w.code === "LTV_EXCEEDED" && w.level === "block")).toBe(true);
  });

  it("warns when the term is not offered on the program", () => {
    const quote = calculate(deal("TX", { term: 84 }), { lender: subprime });
    expect(quote.warnings.some((w) => w.code === "TERM_UNAVAILABLE")).toBe(true);
  });

  it("blocks when financed back-end exceeds the lender's cap", () => {
    const input = deal("TX");
    const loaded: DealInput = {
      ...input,
      fiProducts: input.fiProducts.map((p) => ({ ...p, selected: true })),
    };
    const quote = calculate(loaded, { lender: subprime });
    expect(quote.warnings.some((w) => w.code === "BACKEND_EXCEEDED")).toBe(true);
  });

  it("warns when the dealer is buying the rate down below buy rate", () => {
    const quote = calculate(deal("TX", { sellRate: 0.019, buyRate: 0.0629 }));
    expect(quote.warnings.some((w) => w.code === "RATE_BELOW_BUY")).toBe(true);
  });

  it("raises no lender warnings when no lender is supplied", () => {
    const quote = calculate(deal("TX", { term: 84 }));
    expect(quote.warnings.some((w) => w.code === "TERM_UNAVAILABLE")).toBe(false);
  });
});

describe("state data integrity", () => {
  it("flags every unverified state on the quote", () => {
    const quote = calculate(deal("TX"));
    expect(quote.warnings.some((w) => w.code === "STATE_UNVERIFIED")).toBe(true);
  });

  it("warns loudly on states whose regime is only approximated", () => {
    const quote = calculate(deal("SC"));
    expect(quote.warnings.some((w) => w.code === "STATE_APPROXIMATED" && w.level === "warn")).toBe(
      true,
    );
  });

  it("calculates without throwing in all 51 jurisdictions", () => {
    const codes = Object.keys(STATE_RULES) as StateCode[];
    expect(codes).toHaveLength(51);
    for (const code of codes) {
      for (const dealType of ["finance", "lease", "cash", "balloon"] as const) {
        const quote = calculate(deal(code, { dealType }));
        expect(quote.monthlyPayment).toBeGreaterThanOrEqual(0);
        expect(quote.amountFinanced).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(quote.monthlyPayment)).toBe(true);
        // `apr` is a decimal on every deal type. A value above 1.0 means a
        // percentage leaked in and the UI would render 348% instead of 3.48%.
        expect(quote.apr).toBeLessThan(1);
      }
    }
  });
});
