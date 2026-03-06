import { validateFormulaAST } from '../validator';

describe('validator - valid expressions', () => {
  it('arithmetic "area_m2 * rate_per_m2" returns { valid: true, errors: [] }', () => {
    const result = validateFormulaAST('area_m2 * rate_per_m2');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('conditional expression returns { valid: true, errors: [] }', () => {
    const result = validateFormulaAST('revenue > 100000 ? revenue * 0.08 : revenue * 0.05');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('complex expression with multiple whitelisted functions returns { valid: true }', () => {
    const result = validateFormulaAST('max(area_m2 * rate, min(floor_area * base_rate, 50000))');
    expect(result.valid).toBe(true);
  });
});

describe('validator - assignment rejection', () => {
  it('assignment "x = 5" returns { valid: false } with "Assignment" error', () => {
    const result = validateFormulaAST('x = 5');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Assignment'))).toBe(true);
  });
});

describe('validator - function definition rejection', () => {
  it('function definition "f(x) = x * 2" returns { valid: false } with "Function definition" error', () => {
    const result = validateFormulaAST('f(x) = x * 2');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Function definition'))).toBe(true);
  });
});

describe('validator - forbidden identifiers', () => {
  it('"process" returns { valid: false } with error about process', () => {
    const result = validateFormulaAST('process');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("'process'"))).toBe(true);
  });

  it('"require" returns { valid: false } with error mentioning require', () => {
    const result = validateFormulaAST('require');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("'require'"))).toBe(true);
  });

  it('"eval" returns { valid: false } with error mentioning eval', () => {
    const result = validateFormulaAST('eval');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("'eval'"))).toBe(true);
  });

  it('nested forbidden "add(1, process)" returns { valid: false }', () => {
    const result = validateFormulaAST('add(1, process)');
    expect(result.valid).toBe(false);
  });
});

describe('validator - parse errors', () => {
  it('invalid syntax "2 + + +" returns { valid: false } with "Parse error"', () => {
    const result = validateFormulaAST('2 + + +');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Parse error'))).toBe(true);
  });
});
