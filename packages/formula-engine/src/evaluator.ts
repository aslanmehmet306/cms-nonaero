import Decimal from 'decimal.js';
import { limitedEvaluate } from './sandbox';
import { validateFormulaAST } from './validator';
import type { FormulaEvaluationResult, FormulaScope } from './types';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Evaluate a formula expression with a timeout guard.
 *
 * Process:
 * 1. Validate the AST for security violations — reject before any evaluation
 * 2. Race evaluation against a timeout promise
 * 3. Wrap numeric result with Decimal.js for financial precision
 * 4. Return structured result with trace info
 *
 * @param expression - The formula expression to evaluate
 * @param scope - Variable scope for substitution
 * @param timeoutMs - Maximum evaluation time in ms (default: 100)
 * @returns FormulaEvaluationResult with success flag, string result, and optional trace
 */
export async function evaluateWithTimeout(
  expression: string,
  scope: FormulaScope,
  timeoutMs: number = 100,
): Promise<FormulaEvaluationResult> {
  const startTime = Date.now();

  // 1. Validate AST for security violations
  const validation = validateFormulaAST(expression);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join('; '),
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Race evaluation against timeout
  const evalPromise = Promise.resolve().then(() => {
    // Cast scope to match limitedEvaluate's expected type
    const evalScope = scope as Record<string, number | boolean | number[]>;
    return limitedEvaluate(expression, evalScope);
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Formula evaluation timeout exceeded')), timeoutMs),
  );

  try {
    const rawResult = await Promise.race([evalPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    // 3. Wrap numeric result with Decimal.js for precision.
    // Math.js evaluates using JavaScript floats (e.g. 0.1 + 0.2 = 0.30000000000000004).
    // We convert to Decimal using the string representation and normalize to remove
    // floating-point noise by rounding to 15 significant digits (JavaScript float precision).
    const numericResult = rawResult as number | string | boolean;
    let resultStr: string;

    if (typeof numericResult === 'boolean') {
      resultStr = numericResult.toString();
    } else {
      // Convert float to string first, then wrap with Decimal
      // Use toPrecision(15) to eliminate floating-point noise, then trim trailing zeros
      const asNumber = typeof numericResult === 'string' ? parseFloat(numericResult) : numericResult;
      const normalized = parseFloat(asNumber.toPrecision(15));
      const resultDecimal = new Decimal(normalized);
      resultStr = resultDecimal.toString();
    }

    // 4. Return structured result
    return {
      success: true,
      result: resultStr,
      durationMs,
      trace: {
        expression,
        scope,
        calculatedValue: resultStr,
        durationMs,
      },
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      durationMs,
    };
  }
}

/**
 * Convenience wrapper for evaluateWithTimeout that returns the result string directly.
 * Throws if evaluation fails.
 *
 * @param expression - The formula expression to evaluate
 * @param scope - Variable scope for substitution
 * @param timeoutMs - Maximum evaluation time in ms (default: 100)
 * @returns The evaluation result as a Decimal-compatible string
 * @throws Error if validation fails, variable is undefined, or timeout is exceeded
 */
export async function evaluateFormula(
  expression: string,
  scope: FormulaScope,
  timeoutMs: number = 100,
): Promise<string> {
  const result = await evaluateWithTimeout(expression, scope, timeoutMs);
  if (!result.success) {
    throw new Error(result.error ?? 'Formula evaluation failed');
  }
  return result.result!;
}
