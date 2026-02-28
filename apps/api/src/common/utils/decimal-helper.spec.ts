import { DecimalHelper } from './decimal-helper';

describe('DecimalHelper', () => {
  describe('add', () => {
    it('should add 0.1 + 0.2 and return exactly 0.3 (no floating-point error)', () => {
      expect(DecimalHelper.add('0.1', '0.2').toString()).toBe('0.3');
    });

    it('should add two positive numbers', () => {
      expect(DecimalHelper.add('100', '200').toString()).toBe('300');
    });

    it('should handle adding zero', () => {
      expect(DecimalHelper.add('100', '0').toString()).toBe('100');
    });

    it('should handle adding negative numbers', () => {
      expect(DecimalHelper.add('100', '-50').toString()).toBe('50');
    });
  });

  describe('subtract', () => {
    it('should subtract correctly', () => {
      expect(DecimalHelper.subtract('100', '0.01').toString()).toBe('99.99');
    });

    it('should handle large number subtraction', () => {
      expect(DecimalHelper.subtract('1000000000', '1').toString()).toBe('999999999');
    });
  });

  describe('multiply', () => {
    it('should multiply and keep 4 decimal places', () => {
      expect(DecimalHelper.multiply('100.50', '1.15').toString()).toBe('115.575');
    });

    it('should handle multiplication resulting in many decimals', () => {
      // 33.3333 * 3 = 99.9999
      expect(DecimalHelper.multiply('33.3333', '3').toString()).toBe('99.9999');
    });

    it('should multiply by zero', () => {
      expect(DecimalHelper.multiply('999', '0').toString()).toBe('0');
    });
  });

  describe('divide', () => {
    it('should divide with 4 decimal precision', () => {
      expect(DecimalHelper.divide('100', '3').toString()).toBe('33.3333');
    });

    it('should divide evenly', () => {
      expect(DecimalHelper.divide('100', '4').toString()).toBe('25');
    });

    it('should throw on division by zero', () => {
      expect(() => DecimalHelper.divide('100', '0')).toThrow();
    });
  });

  describe('roundMoney', () => {
    it('should round up at .575 (HALF_UP)', () => {
      expect(DecimalHelper.roundMoney('115.575').toString()).toBe('115.58');
    });

    it('should round down at .574', () => {
      expect(DecimalHelper.roundMoney('115.574').toString()).toBe('115.57');
    });

    it('should keep exact cents', () => {
      expect(DecimalHelper.roundMoney('100.00').toString()).toBe('100');
    });

    it('should handle rounding with many decimal places', () => {
      expect(DecimalHelper.roundMoney('99.9999').toString()).toBe('100');
    });
  });

  describe('isZero', () => {
    it('should return true for zero', () => {
      expect(DecimalHelper.isZero('0')).toBe(true);
    });

    it('should return true for 0.00', () => {
      expect(DecimalHelper.isZero('0.00')).toBe(true);
    });

    it('should return false for non-zero', () => {
      expect(DecimalHelper.isZero('0.001')).toBe(false);
    });
  });

  describe('isPositive', () => {
    it('should return true for positive', () => {
      expect(DecimalHelper.isPositive('1')).toBe(true);
    });

    it('should return false for zero', () => {
      expect(DecimalHelper.isPositive('0')).toBe(false);
    });

    it('should return false for negative', () => {
      expect(DecimalHelper.isPositive('-1')).toBe(false);
    });
  });

  describe('isNegative', () => {
    it('should return true for negative', () => {
      expect(DecimalHelper.isNegative('-1')).toBe(true);
    });

    it('should return false for zero', () => {
      expect(DecimalHelper.isNegative('0')).toBe(false);
    });

    it('should return false for positive', () => {
      expect(DecimalHelper.isNegative('1')).toBe(false);
    });
  });

  describe('max', () => {
    it('should return the larger value', () => {
      expect(DecimalHelper.max('100', '200').toString()).toBe('200');
    });

    it('should handle equal values', () => {
      expect(DecimalHelper.max('50', '50').toString()).toBe('50');
    });
  });

  describe('min', () => {
    it('should return the smaller value', () => {
      expect(DecimalHelper.min('100', '200').toString()).toBe('100');
    });
  });

  describe('toNumber', () => {
    it('should convert to JavaScript number', () => {
      const result = DecimalHelper.toNumber(DecimalHelper.add('1', '2'));
      expect(result).toBe(3);
      expect(typeof result).toBe('number');
    });
  });

  describe('format', () => {
    it('should format with currency', () => {
      const result = DecimalHelper.format('1234.5', 'TRY');
      expect(result).toContain('1234.50');
    });

    it('should format without currency', () => {
      const result = DecimalHelper.format('1234.5');
      expect(result).toBe('1234.50');
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers (1 billion)', () => {
      expect(DecimalHelper.add('1000000000', '1').toString()).toBe('1000000001');
    });

    it('should handle tiny fractions', () => {
      const result = DecimalHelper.add('0.0000001', '0.0000002');
      expect(result.toFixed(7)).toBe('0.0000003');
    });
  });
});
