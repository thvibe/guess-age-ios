import { describe, expect, it } from "vitest";
import {
  payment,
  paymentWithBalloon,
  presentValue,
  remainingBalance,
  schedule,
  solveApr,
} from "@/lib/desking/amortization";
import { dollars, toDollars } from "@/lib/desking/money";

describe("payment", () => {
  it("matches a known amortization figure", () => {
    // $25,000 at 6% for 60 months is $483.32 by standard amortization.
    const result = payment(dollars(25000), 0.06, 60);
    expect(toDollars(result)).toBeCloseTo(483.32, 2);
  });

  it("degrades to simple division at a zero rate", () => {
    expect(payment(dollars(24000), 0, 48)).toBe(dollars(500));
  });

  it("returns zero for a non-positive term", () => {
    expect(payment(dollars(10000), 0.05, 0)).toBe(0);
  });

  it("produces a lower payment as the term lengthens", () => {
    const p60 = payment(dollars(30000), 0.07, 60);
    const p84 = payment(dollars(30000), 0.07, 84);
    expect(p84).toBeLessThan(p60);
  });
});

describe("paymentWithBalloon", () => {
  it("is cheaper than a fully amortizing payment", () => {
    const full = payment(dollars(40000), 0.07, 60);
    const balloon = paymentWithBalloon(dollars(40000), 0.07, 60, dollars(15000));
    expect(balloon).toBeLessThan(full);
  });

  it("equals the fully amortizing payment when the balloon is zero", () => {
    const full = payment(dollars(40000), 0.07, 60);
    const balloon = paymentWithBalloon(dollars(40000), 0.07, 60, 0 as never);
    expect(Math.abs(balloon - full)).toBeLessThanOrEqual(1);
  });

  it("handles a zero rate", () => {
    // ($36,000 − $12,000) / 48 = $500
    expect(paymentWithBalloon(dollars(36000), 0, 48, dollars(12000))).toBe(dollars(500));
  });
});

describe("presentValue", () => {
  it("inverts payment()", () => {
    const principal = dollars(22000);
    const pmt = payment(principal, 0.0599, 60);
    const pv = presentValue(pmt, 0.0599, 60);
    // Round-trip through cent rounding, so allow a dollar of drift.
    expect(Math.abs(pv - principal)).toBeLessThan(100);
  });
});

describe("remainingBalance", () => {
  it("is zero at the end of the term", () => {
    expect(remainingBalance(dollars(20000), 0.06, 60, 60)).toBe(0);
  });

  it("declines monotonically", () => {
    const b12 = remainingBalance(dollars(20000), 0.06, 60, 12);
    const b24 = remainingBalance(dollars(20000), 0.06, 60, 24);
    expect(b24).toBeLessThan(b12);
  });
});

describe("solveApr", () => {
  it("recovers the rate used to build the payment", () => {
    const principal = dollars(28500);
    const apr = 0.0749;
    const pmt = payment(principal, apr, 72);
    expect(solveApr(principal, pmt, 72)).toBeCloseTo(apr, 4);
  });

  it("returns zero when the payment stream never retires the principal", () => {
    expect(solveApr(dollars(30000), dollars(100), 60)).toBe(0);
  });
});

describe("schedule", () => {
  it("retires the balance exactly", () => {
    const rows = schedule(dollars(18000), 0.0649, 48);
    expect(rows).toHaveLength(48);
    expect(rows[47]!.balance).toBe(0);
  });

  it("lands exactly on the balloon amount", () => {
    const balloon = dollars(14000);
    const rows = schedule(dollars(35000), 0.0699, 60, balloon);
    expect(rows[59]!.balance).toBe(balloon);
  });

  it("shifts interest toward the front of the loan", () => {
    const rows = schedule(dollars(30000), 0.08, 60);
    expect(rows[0]!.interest).toBeGreaterThan(rows[59]!.interest);
    expect(rows[0]!.principal).toBeLessThan(rows[59]!.principal);
  });

  it("sums principal payments to the original balance", () => {
    const principal = dollars(21500);
    const rows = schedule(principal, 0.055, 36);
    const totalPrincipal = rows.reduce((sum, r) => sum + r.principal, 0);
    expect(totalPrincipal).toBe(principal);
  });
});
