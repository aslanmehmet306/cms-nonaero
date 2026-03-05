import { evaluateStepBand } from '../step-band';
import type { Band } from '../types';

describe('evaluateStepBand - single band', () => {
  it('single band with revenue within band returns proportional amount', () => {
    const bands: Band[] = [{ from: 0, to: 100000, rate: 0.05 }];
    const result = evaluateStepBand(50000, bands);
    expect(result).toBe('2500');
  });
});

describe('evaluateStepBand - multi-band', () => {
  it('two bands with revenue spanning both tiers returns correct total', () => {
    const bands: Band[] = [
      { from: 0, to: 100000, rate: 0.05 },
      { from: 100000, to: 300000, rate: 0.08 },
    ];
    // 100000 * 0.05 = 5000
    // 150000 * 0.08 = 12000
    // Total = 17000
    const result = evaluateStepBand(250000, bands);
    expect(result).toBe('17000');
  });

  it('revenue at exact band boundary calculates correctly', () => {
    const bands: Band[] = [
      { from: 0, to: 100000, rate: 0.05 },
      { from: 100000, to: 300000, rate: 0.08 },
    ];
    // Exactly at boundary: 100000 * 0.05 = 5000
    const result = evaluateStepBand(100000, bands);
    expect(result).toBe('5000');
  });
});

describe('evaluateStepBand - edge cases', () => {
  it('revenue below first band threshold returns proportional amount for that range', () => {
    const bands: Band[] = [{ from: 0, to: 100000, rate: 0.05 }];
    const result = evaluateStepBand(10000, bands);
    expect(result).toBe('500');
  });

  it('revenue exceeding all bands stops at last band boundary', () => {
    const bands: Band[] = [
      { from: 0, to: 100000, rate: 0.05 },
      { from: 100000, to: 300000, rate: 0.08 },
    ];
    // Revenue 500000 > last band to (300000)
    // 100000 * 0.05 = 5000
    // 200000 * 0.08 = 16000
    // Total = 21000 (stops at last band boundary of 300000)
    const result = evaluateStepBand(500000, bands);
    expect(result).toBe('21000');
  });

  it('empty bands returns "0"', () => {
    const result = evaluateStepBand(50000, []);
    expect(result).toBe('0');
  });

  it('bands in wrong order are sorted automatically', () => {
    const bands: Band[] = [
      { from: 100000, to: 300000, rate: 0.08 },
      { from: 0, to: 100000, rate: 0.05 },
    ];
    const result = evaluateStepBand(250000, bands);
    expect(result).toBe('17000');
  });
});
