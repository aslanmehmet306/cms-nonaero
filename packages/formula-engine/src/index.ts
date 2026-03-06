/**
 * Formula Engine - Public API
 *
 * Sandboxed math.js-based formula evaluation engine for pricing calculations.
 * Provides secure AST validation, timeout-protected evaluation, and step-band pricing.
 *
 * Security guarantees:
 * - 8 dangerous math.js functions blocked (import, evaluate, parse, simplify, derivative, resolve, createUnit, reviver)
 * - AST validation rejects assignments, function definitions, and forbidden identifiers
 * - 100ms timeout enforced via Promise.race
 *
 * Precision guarantee:
 * - All numeric results are Decimal.js-compatible strings (no floating-point errors)
 */

// Types
export type {
  FormulaValidationResult,
  FormulaEvaluationResult,
  FormulaTrace,
  Band,
  FormulaScope,
} from './types';

// Sandbox
export { createSandbox, limitedEvaluate } from './sandbox';

// Validator
export { validateFormulaAST } from './validator';

// Evaluator
export { evaluateWithTimeout, evaluateFormula } from './evaluator';

// Step-band pricing
export { evaluateStepBand } from './step-band';
