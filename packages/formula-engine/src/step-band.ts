import Decimal from 'decimal.js';
import type { Band } from './types';

// Configure Decimal.js for financial precision (matches global config)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculate progressive commission using step-band (tiered pricing) logic.
 *
 * Each band covers a revenue range with a specific rate. Revenue is distributed
 * progressively across bands, similar to income tax brackets.
 *
 * Example:
 *   bands = [{from:0, to:100000, rate:0.05}, {from:100000, to:300000, rate:0.08}]
 *   revenue = 250000
 *   result = 100000*0.05 + 150000*0.08 = 5000 + 12000 = 17000
 *
 * @param revenue - The total revenue amount (number or Decimal-compatible string)
 * @param bands - Array of Band objects defining tiers (will be sorted by 'from')
 * @returns Total commission as a Decimal-compatible string
 */
export function evaluateStepBand(revenue: number | string, bands: Band[]): string {
  if (bands.length === 0) {
    return '0';
  }

  const revenueDecimal = new Decimal(revenue);

  // Sort bands by from ascending to ensure correct progressive calculation
  const sortedBands = [...bands].sort((a, b) => a.from - b.from);

  let total = new Decimal(0);

  for (const band of sortedBands) {
    const bandFrom = new Decimal(band.from);
    const bandTo = new Decimal(band.to);
    const rate = new Decimal(band.rate);

    // Skip bands entirely above revenue
    if (revenueDecimal.lessThanOrEqualTo(bandFrom)) {
      break;
    }

    // Calculate the portion of revenue in this band
    const effectiveTo = Decimal.min(revenueDecimal, bandTo);
    const amountInBand = effectiveTo.minus(bandFrom);

    // Calculate commission for this band portion
    const bandCommission = amountInBand.times(rate);
    total = total.plus(bandCommission);
  }

  return total.toString();
}
