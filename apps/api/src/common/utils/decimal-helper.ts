import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Static utility class wrapping Decimal.js for safe financial calculations.
 * All monetary calculations MUST go through this helper to avoid floating-point errors.
 *
 * Key guarantee: DecimalHelper.add('0.1', '0.2').toString() === '0.3'
 */
export class DecimalHelper {
  /** Add two values. Returns exact Decimal result. */
  static add(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  /** Subtract b from a. Returns exact Decimal result. */
  static subtract(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  /** Multiply two values. Returns result with up to 4 decimal places (ROUND_HALF_UP). */
  static multiply(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).times(new Decimal(b)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  /** Divide a by b. Returns result with up to 4 decimal places (ROUND_HALF_UP). Throws on division by zero. */
  static divide(a: Decimal.Value, b: Decimal.Value): Decimal {
    const divisor = new Decimal(b);
    if (divisor.isZero()) {
      throw new Error('Division by zero');
    }
    return new Decimal(a).dividedBy(divisor).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  /** Round to 2 decimal places (money precision) using ROUND_HALF_UP. */
  static roundMoney(value: Decimal.Value): Decimal {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /** Check if a value is exactly zero. */
  static isZero(value: Decimal.Value): boolean {
    return new Decimal(value).isZero();
  }

  /** Check if a value is strictly positive (> 0). */
  static isPositive(value: Decimal.Value): boolean {
    return new Decimal(value).isPositive() && !new Decimal(value).isZero();
  }

  /** Check if a value is strictly negative (< 0). */
  static isNegative(value: Decimal.Value): boolean {
    return new Decimal(value).isNegative() && !new Decimal(value).isZero();
  }

  /** Return the larger of two values. */
  static max(a: Decimal.Value, b: Decimal.Value): Decimal {
    return Decimal.max(new Decimal(a), new Decimal(b));
  }

  /** Return the smaller of two values. */
  static min(a: Decimal.Value, b: Decimal.Value): Decimal {
    return Decimal.min(new Decimal(a), new Decimal(b));
  }

  /**
   * Convert a Decimal to a JavaScript number.
   * WARNING: Use ONLY for display purposes, never for further calculations.
   */
  static toNumber(value: Decimal): number {
    return value.toNumber();
  }

  /**
   * Format a value as a monetary string with 2 decimal places.
   * Optionally prefix with currency code.
   */
  static format(value: Decimal.Value, currency?: string): string {
    const formatted = new Decimal(value).toFixed(2);
    if (currency) {
      return `${currency} ${formatted}`;
    }
    return formatted;
  }
}
