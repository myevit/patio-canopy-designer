import { describe, expect, it } from "vitest";
import { DEFAULT_STOCK_ALLOWANCE_MM, STANDARD_STOCK_LENGTHS_MM, deriveStockLength } from "./stock-allowance.js";

describe("deriveStockLength", () => {
  it("keeps the required length (finished + allowance) explicit and separate from the finished length", () => {
    const result = deriveStockLength(2350, 50);
    expect(result.requiredLengthMm).toBe(2400);
  });

  it("picks the smallest standard stock length that covers the required length", () => {
    const result = deriveStockLength(2350, 50, [1800, 2400, 3000, 3600]);
    expect(result.requiredLengthMm).toBe(2400);
    expect(result.stockLengthMm).toBe(2400);
    expect(result.fitsStandardStock).toBe(true);
  });

  it("rounds up to the next standard length when the exact required length isn't stocked", () => {
    const result = deriveStockLength(2360, 50, [1800, 2400, 3000, 3600]);
    expect(result.requiredLengthMm).toBe(2410);
    expect(result.stockLengthMm).toBe(3000);
    expect(result.fitsStandardStock).toBe(true);
  });

  it("flags when the required length exceeds every standard stock length instead of silently under-cutting", () => {
    const result = deriveStockLength(7300, 50, [1800, 2400, 3000, 3600, 6000]);
    expect(result.requiredLengthMm).toBe(7350);
    expect(result.fitsStandardStock).toBe(false);
    expect(result.stockLengthMm).toBe(7350);
  });

  it("defaults to the module's allowance and standard catalog when not overridden", () => {
    const result = deriveStockLength(2350);
    expect(result.requiredLengthMm).toBe(2350 + DEFAULT_STOCK_ALLOWANCE_MM);
    expect(STANDARD_STOCK_LENGTHS_MM).toContain(result.stockLengthMm);
  });
});
