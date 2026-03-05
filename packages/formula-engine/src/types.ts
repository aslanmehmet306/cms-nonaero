/**
 * TypeScript interfaces for the formula engine.
 * All monetary results are returned as strings for Decimal.js compatibility.
 */

/** Result of validating a formula expression against security/syntax rules */
export interface FormulaValidationResult {
  valid: boolean;
  errors: string[];
}

/** Trace information for debugging formula evaluation */
export interface FormulaTrace {
  expression: string;
  scope: Record<string, unknown>;
  calculatedValue: string;
  durationMs: number;
}

/** Result of evaluating a formula expression */
export interface FormulaEvaluationResult {
  success: boolean;
  result?: string;
  error?: string;
  durationMs?: number;
  trace?: FormulaTrace;
}

/** A single band in a step-band tiered pricing structure */
export interface Band {
  from: number;
  to: number;
  rate: number;
}

/** Variable scope for formula evaluation */
export type FormulaScope = Record<string, number | number[] | Band[]>;
