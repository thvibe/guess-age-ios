import { describe, expect, it } from "vitest";
import { createDefaultDeal } from "@/data/defaultDeal";
import { getStateRule } from "@/data/states";
import { dollars, toDollars } from "@/lib/desking/money";
import { computeRetailTax } from "@/lib/desking/taxes";
import type { DealInput, StateCode, Trade } from "@/lib/desking/types";

function dealIn(state: StateCode, overrides: Partial<DealInput> = {}): DealInput {
  return {
    ...createDefaultDeal(state),
    // Zero out fees so each test isolates the base derivation it cares about.
    fees: [],
    localTaxRateOverride: 0,
    ...overrides,
  };
}

const trade: Trade = {
  allowance: dollars(15000),
  actualCashValue: dollars(15000),
  payoff: dollars(0),
};

describe("trade-in credit by state", () => {
  it("Texas taxes price less the full trade allowance", () => {
    const input = dealIn("TX", { sellingPrice: dollars(40000), trade });
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(toDollars(tax.taxableBase)).toBe(25000);
    // 6.25% of $25,000
    expect(toDollars(tax.total)).toBeCloseTo(1562.5, 2);
  });

  it("California gives no trade credit and taxes the full price", () => {
    const input = dealIn("CA", { sellingPrice: dollars(40000), trade });
    const tax = computeRetailTax(input, getStateRule("CA"));
    expect(toDollars(tax.taxableBase)).toBe(40000);
  });

  it("the same deal costs materially more tax in CA than TX", () => {
    const ca = computeRetailTax(
      dealIn("CA", { sellingPrice: dollars(40000), trade }),
      getStateRule("CA"),
    );
    const tx = computeRetailTax(
      dealIn("TX", { sellingPrice: dollars(40000), trade }),
      getStateRule("TX"),
    );
    expect(ca.total).toBeGreaterThan(tx.total);
  });

  it("Michigan caps the trade credit", () => {
    const rule = getStateRule("MI");
    const input = dealIn("MI", { sellingPrice: dollars(40000), trade });
    const tax = computeRetailTax(input, rule);
    expect(rule.tradeInCredit.kind).toBe("capped");
    if (rule.tradeInCredit.kind === "capped") {
      expect(tax.taxableBase).toBe(dollars(40000) - rule.tradeInCredit.max);
    }
  });

  it("never lets a large trade drive the base below zero", () => {
    const input = dealIn("TX", {
      sellingPrice: dollars(10000),
      trade: { ...trade, allowance: dollars(30000) },
    });
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(tax.taxableBase).toBe(0);
    expect(tax.total).toBe(0);
  });
});

describe("rebate taxability", () => {
  it("Texas taxes after the rebate", () => {
    const input = dealIn("TX", { sellingPrice: dollars(40000), rebates: dollars(2000) });
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(toDollars(tax.taxableBase)).toBe(38000);
  });

  it("California taxes the pre-rebate price", () => {
    const input = dealIn("CA", { sellingPrice: dollars(40000), rebates: dollars(2000) });
    const tax = computeRetailTax(input, getStateRule("CA"));
    expect(toDollars(tax.taxableBase)).toBe(40000);
    expect(tax.explanation.some((line) => line.includes("NOT deducted"))).toBe(true);
  });
});

describe("Florida discretionary surtax", () => {
  it("applies the county rate only to the first $5,000 of the base", () => {
    const input = dealIn("FL", {
      sellingPrice: dollars(40000),
      localTaxRateOverride: 0.01,
    });
    const tax = computeRetailTax(input, getStateRule("FL"));
    // 1% of $5,000, not of $40,000.
    expect(toDollars(tax.localTax)).toBeCloseTo(50, 2);
    expect(toDollars(tax.stateTax)).toBeCloseTo(2400, 2);
  });

  it("does not cap the base in a state without the rule", () => {
    const input = dealIn("NY", {
      sellingPrice: dollars(40000),
      localTaxRateOverride: 0.045,
    });
    const tax = computeRetailTax(input, getStateRule("NY"));
    expect(toDollars(tax.localTax)).toBeCloseTo(1800, 2);
  });
});

describe("taxable fees and F&I", () => {
  it("adds taxable fees to the base after the trade clamp", () => {
    const input = dealIn("TX", {
      sellingPrice: dollars(10000),
      trade: { ...trade, allowance: dollars(30000) },
      fees: [
        {
          id: "doc",
          label: "Doc",
          kind: "doc",
          amount: dollars(500),
          taxable: true,
          capitalized: true,
          subjectToDocCap: true,
        },
      ],
    });
    const tax = computeRetailTax(input, getStateRule("TX"));
    // The trade wipes out the vehicle base, but the taxable doc fee survives.
    expect(toDollars(tax.taxableBase)).toBe(500);
  });

  it("respects a per-product taxability override", () => {
    const base = dealIn("TX", { sellingPrice: dollars(30000) });
    const input: DealInput = {
      ...base,
      fiProducts: [
        {
          id: "vsc",
          name: "VSC",
          category: "vsc",
          price: dollars(2000),
          cost: dollars(900),
          capitalized: true,
          taxableOverride: true,
          selected: true,
        },
      ],
    };
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(toDollars(tax.taxableBase)).toBe(32000);
  });

  it("ignores unselected F&I products", () => {
    const base = dealIn("TX", { sellingPrice: dollars(30000) });
    const input: DealInput = {
      ...base,
      fiProducts: [
        {
          id: "vsc",
          name: "VSC",
          category: "vsc",
          price: dollars(2000),
          cost: dollars(900),
          capitalized: true,
          taxableOverride: true,
          selected: false,
        },
      ],
    };
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(toDollars(tax.taxableBase)).toBe(30000);
  });
});

describe("no-sales-tax states", () => {
  it.each(["MT", "NH", "AK"] as StateCode[])("%s produces zero tax", (code) => {
    const tax = computeRetailTax(dealIn(code, { sellingPrice: dollars(40000) }), getStateRule(code));
    expect(tax.total).toBe(0);
  });
});

describe("explanation trail", () => {
  it("records every step so a desk can audit the base", () => {
    const input = dealIn("TX", {
      sellingPrice: dollars(40000),
      rebates: dollars(1000),
      trade,
    });
    const tax = computeRetailTax(input, getStateRule("TX"));
    expect(tax.explanation.length).toBeGreaterThanOrEqual(4);
    expect(tax.explanation[0]).toContain("Selling price");
    expect(tax.explanation.some((l) => l.includes("Rebates"))).toBe(true);
    expect(tax.explanation.some((l) => l.includes("Trade allowance"))).toBe(true);
  });
});
