/** Extra length reserved at cut time for trimming/cleanup, added to every finished length before stock is picked. */
export const DEFAULT_STOCK_ALLOWANCE_MM = 50;

/** Common dimensional-lumber stock lengths, in millimetres, ascending. */
export const STANDARD_STOCK_LENGTHS_MM = [1800, 2400, 3000, 3600, 4200, 4800, 5400, 6000, 7200];

export interface StockLengthResult {
  /** finishedLengthMm + allowanceMm, kept explicit and separate from the exact finished geometry. */
  requiredLengthMm: number;
  /** The smallest standard stock length that covers requiredLengthMm, or requiredLengthMm itself if none does. */
  stockLengthMm: number;
  fitsStandardStock: boolean;
}

export function deriveStockLength(
  finishedLengthMm: number,
  allowanceMm: number = DEFAULT_STOCK_ALLOWANCE_MM,
  standardLengthsMm: readonly number[] = STANDARD_STOCK_LENGTHS_MM,
): StockLengthResult {
  const requiredLengthMm = finishedLengthMm + allowanceMm;
  const stockLengthMm = standardLengthsMm
    .filter((length) => length >= requiredLengthMm)
    .sort((a, b) => a - b)[0];

  if (stockLengthMm === undefined) {
    return { requiredLengthMm, stockLengthMm: requiredLengthMm, fitsStandardStock: false };
  }
  return { requiredLengthMm, stockLengthMm, fitsStandardStock: true };
}
