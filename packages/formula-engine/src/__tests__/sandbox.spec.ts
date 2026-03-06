import { limitedEvaluate, createSandbox } from '../sandbox';

describe('sandbox - whitelisted functions', () => {
  it('add(2, 3) evaluates to 5', () => {
    expect(limitedEvaluate('add(2, 3)')).toBe(5);
  });

  it('multiply(4, 5) evaluates to 20', () => {
    expect(limitedEvaluate('multiply(4, 5)')).toBe(20);
  });

  it('max(3, 7) evaluates to 7', () => {
    expect(limitedEvaluate('max(3, 7)')).toBe(7);
  });

  it('min(3, 7) evaluates to 3', () => {
    expect(limitedEvaluate('min(3, 7)')).toBe(3);
  });

  it('round(3.7) evaluates to 4', () => {
    expect(limitedEvaluate('round(3.7)')).toBe(4);
  });

  it('floor(3.7) evaluates to 3', () => {
    expect(limitedEvaluate('floor(3.7)')).toBe(3);
  });

  it('ceil(3.2) evaluates to 4', () => {
    expect(limitedEvaluate('ceil(3.2)')).toBe(4);
  });

  it('abs(-5) evaluates to 5', () => {
    expect(limitedEvaluate('abs(-5)')).toBe(5);
  });
});

describe('sandbox - arithmetic expressions', () => {
  it('"2 + 3 * 4" evaluates to 14', () => {
    expect(limitedEvaluate('2 + 3 * 4')).toBe(14);
  });

  it('"10 / 3" returns a number', () => {
    expect(typeof limitedEvaluate('10 / 3')).toBe('number');
  });
});

describe('sandbox - comparison and ternary operators', () => {
  it('"5 > 3" evaluates to true', () => {
    expect(limitedEvaluate('5 > 3')).toBe(true);
  });

  it('"2 == 2" evaluates to true', () => {
    expect(limitedEvaluate('2 == 2')).toBe(true);
  });

  it('"5 > 3 ? 10 : 20" evaluates to 10', () => {
    expect(limitedEvaluate('5 > 3 ? 10 : 20')).toBe(10);
  });
});

describe('sandbox - dangerous functions are blocked', () => {
  it('import throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('import("lodash")')).toThrow(/disabled/i);
  });

  it('evaluate throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('evaluate("1 + 1")')).toThrow(/disabled/i);
  });

  it('parse throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('parse("1 + 1")')).toThrow(/disabled/i);
  });

  it('simplify throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('simplify("x + x")')).toThrow(/disabled/i);
  });

  it('derivative throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('derivative("x^2", "x")')).toThrow(/disabled/i);
  });

  it('resolve throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('resolve("x + 1")')).toThrow(/disabled/i);
  });

  it('createUnit throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('createUnit("foo")')).toThrow(/disabled/i);
  });

  it('reviver throws error containing "disabled"', () => {
    expect(() => limitedEvaluate('reviver()')).toThrow(/disabled/i);
  });
});

describe('createSandbox factory', () => {
  it('creates an isolated math instance', () => {
    const math = createSandbox();
    expect(math).toBeDefined();
    expect(typeof math.evaluate).toBe('function');
  });
});
