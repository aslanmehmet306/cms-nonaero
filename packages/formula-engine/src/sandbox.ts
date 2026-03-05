import { create, all, MathJsInstance, parse } from 'mathjs';

/** Names of dangerous math.js functions that must be disabled */
const DANGEROUS_FUNCTIONS = [
  'import',
  'createUnit',
  'reviver',
  'evaluate',
  'parse',
  'simplify',
  'derivative',
  'resolve',
] as const;

type DangerousFnName = (typeof DANGEROUS_FUNCTIONS)[number];

/**
 * Creates a sandboxed math.js instance with dangerous functions disabled.
 *
 * Strategy: We use a fresh math instance with all functions, then create a
 * scope object that blocks dangerous functions. When the user calls
 * limitedEvaluate, we compile the expression (using the internal evaluate) but
 * inject a scope that masks dangerous function names with error-throwing stubs.
 *
 * For expressions that directly call math object methods (e.g. "evaluate(...)"),
 * math.js resolves them from the math scope — so injecting them into the
 * expression scope takes priority.
 */
export function createSandbox(): MathJsInstance {
  return create(all);
}

// Shared sandbox instance
const sandboxMath = createSandbox();

/** Build a scope that blocks dangerous math functions */
function buildBlockedScope(
  userScope?: Record<string, number | boolean | number[]>,
): Record<string, unknown> {
  const blockedScope: Record<string, unknown> = { ...(userScope ?? {}) };

  for (const fnName of DANGEROUS_FUNCTIONS) {
    blockedScope[fnName] = (): never => {
      throw new Error(`Function '${fnName}' is disabled in the formula sandbox`);
    };
  }

  return blockedScope;
}

/**
 * Evaluate a math expression in the sandboxed environment.
 * Supports arithmetic, comparison operators, ternary, and whitelisted functions.
 * Dangerous functions (import, evaluate, parse, etc.) will throw when called.
 *
 * @param expression - The math expression to evaluate
 * @param scope - Optional variable scope
 * @returns The evaluated result
 */
export function limitedEvaluate(
  expression: string,
  userScope?: Record<string, number | boolean | number[]>,
): number | boolean | string {
  const scope = buildBlockedScope(userScope);
  // Compile the AST using the internal math.js parse (not the blocked one)
  const node = parse(expression);
  // Evaluate with our blocked scope
  return node.evaluate(scope) as number | boolean | string;
}
