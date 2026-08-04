import { describe, expect, it } from "vitest";
import { createDefaultDeal } from "@/data/defaultDeal";
import { LENDER_PROGRAMS } from "@/data/lenders";
import {
  DEFAULT_TERMS,
  blockedCells,
  buildPaymentGrid,
  closestToPayment,
} from "@/lib/desking/grid";
import { dollars } from "@/lib/desking/money";

const axes = {
  terms: DEFAULT_TERMS,
  downPayments: [dollars(0), dollars(2000), dollars(4000), dollars(6000)],
};

describe("payment grid", () => {
  it("has one row per term and one column per down payment", () => {
    const grid = buildPaymentGrid(createDefaultDeal("TX"), axes);
    expect(grid).toHaveLength(axes.terms.length);
    for (const row of grid) expect(row).toHaveLength(axes.downPayments.length);
  });

  it("payments fall as you move right (more down) and down (longer term)", () => {
    const grid = buildPaymentGrid(createDefaultDeal("TX"), axes);
    for (const row of grid) {
      for (let col = 1; col < row.length; col += 1) {
        expect(row[col]!.quote.monthlyPayment).toBeLessThan(row[col - 1]!.quote.monthlyPayment);
      }
    }
    for (let rowIdx = 1; rowIdx < grid.length; rowIdx += 1) {
      expect(grid[rowIdx]![0]!.quote.monthlyPayment).toBeLessThan(
        grid[rowIdx - 1]![0]!.quote.monthlyPayment,
      );
    }
  });

  it("stamps each cell with the term and down payment that produced it", () => {
    const grid = buildPaymentGrid(createDefaultDeal("TX"), axes);
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        expect(cell.term).toBe(axes.terms[r]);
        expect(cell.cashDown).toBe(axes.downPayments[c]);
        expect(cell.quote.term).toBe(axes.terms[r]);
      });
    });
  });

  it("applies the term to lease deals too", () => {
    const lease = { ...createDefaultDeal("TX", "lease") };
    const grid = buildPaymentGrid(lease, { terms: [24, 36, 48], downPayments: [dollars(2000)] });
    expect(grid[0]![0]!.quote.term).toBe(24);
    expect(grid[2]![0]!.quote.term).toBe(48);
  });

  it("finds the cell nearest a customer's stated payment", () => {
    const grid = buildPaymentGrid(createDefaultDeal("TX"), axes);
    const target = dollars(600);
    const match = closestToPayment(grid, target);
    expect(match).not.toBeNull();

    const bestDelta = Math.abs(match!.quote.monthlyPayment - target);
    for (const cell of grid.flat()) {
      expect(Math.abs(cell.quote.monthlyPayment - target)).toBeGreaterThanOrEqual(bestDelta);
    }
  });

  it("returns null when searching an empty grid", () => {
    expect(closestToPayment([], dollars(500))).toBeNull();
  });

  it("surfaces cells that break lender guidelines", () => {
    const subprime = LENDER_PROGRAMS.find((p) => p.id === "subprime-tier-d")!;
    const grid = buildPaymentGrid(
      { ...createDefaultDeal("TX"), sellingPrice: dollars(44000) },
      axes,
      { lender: subprime },
    );
    const blocked = blockedCells(grid);
    expect(blocked.length).toBeGreaterThan(0);
    // The zero-down, long-term corner is the one that should fail first.
    expect(blocked.some((c) => c.cashDown === dollars(0))).toBe(true);
  });

  it("does not mutate the deal it was given", () => {
    const input = createDefaultDeal("TX");
    const snapshot = JSON.stringify(input);
    buildPaymentGrid(input, axes);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
