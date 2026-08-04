import { describe, expect, it } from "vitest";
import {
  add,
  atLeastZero,
  capped,
  cents,
  dollars,
  formatMoney,
  formatSigned,
  mul,
  parseMoney,
  sub,
  toDollars,
} from "@/lib/desking/money";

describe("money", () => {
  it("stores dollars as integer cents", () => {
    expect(dollars(1234.56)).toBe(123456);
  });

  it("does not accumulate float drift across many additions", () => {
    // The classic 0.1 + 0.2 problem, run 1000 times.
    let total = dollars(0);
    for (let i = 0; i < 1000; i += 1) total = add(total, dollars(0.1));
    expect(toDollars(total)).toBe(100);
  });

  it("rounds half away from zero on construction", () => {
    expect(dollars(0.005)).toBe(1);
  });

  it("clamps negative bases to zero", () => {
    expect(atLeastZero(sub(dollars(100), dollars(250)))).toBe(0);
  });

  it("treats a null cap as uncapped", () => {
    expect(capped(dollars(799), null)).toBe(dollars(799));
    expect(capped(dollars(799), dollars(85))).toBe(dollars(85));
  });

  it("multiplies by a rate and rounds to whole cents", () => {
    expect(mul(dollars(37495), 0.0625)).toBe(dollars(2343.44));
  });

  it("guards against non-finite input", () => {
    expect(dollars(Number.NaN)).toBe(0);
    expect(mul(dollars(100), Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("formats currency and signed values", () => {
    expect(formatMoney(dollars(1234.5))).toBe("$1,234.50");
    expect(formatSigned(dollars(-500))).toBe("−$500.00");
    expect(formatSigned(dollars(500))).toBe("+$500.00");
  });

  it("parses loose user input", () => {
    expect(parseMoney("$28,450.00")).toBe(dollars(28450));
    expect(parseMoney("28450")).toBe(dollars(28450));
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBe(0);
  });

  it("round-trips cents construction", () => {
    expect(cents(12345)).toBe(12345);
  });
});
