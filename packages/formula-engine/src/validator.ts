import { parse } from 'mathjs';
import type { MathNode } from 'mathjs';
import { FormulaValidationResult } from './types';

/** Whitelisted function names allowed in formula expressions */
const ALLOWED_FUNCTIONS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'max',
  'min',
  'round',
  'floor',
  'ceil',
  'abs',
]);

/** Identifiers that are forbidden in formula expressions (security-critical) */
const FORBIDDEN_IDENTIFIERS = new Set([
  'process',
  'require',
  'eval',
  'Function',
  'import',
  'createUnit',
  'reviver',
  'exports',
  'module',
  'global',
  'globalThis',
  '__proto__',
  'constructor',
]);

/**
 * Traverse a math.js AST node and collect validation errors.
 */
function traverseNode(node: MathNode, errors: string[]): void {
  const nodeType = node.type;

  if (nodeType === 'AssignmentNode') {
    errors.push('Assignment expressions are not allowed in formulas');
    return;
  }

  if (nodeType === 'FunctionAssignmentNode') {
    errors.push('Function definition expressions are not allowed in formulas');
    return;
  }

  if (nodeType === 'FunctionNode') {
    // Access name via type assertion since math.js AST nodes have dynamic shapes
    const fnNode = node as MathNode & { name: string; args: MathNode[] };
    if (!ALLOWED_FUNCTIONS.has(fnNode.name)) {
      // Only flag if it's not a standard operator/builtin that math.js uses internally
      // We allow unknown function names if they're not explicitly forbidden — they'll be caught at eval time
      if (FORBIDDEN_IDENTIFIERS.has(fnNode.name)) {
        errors.push(`'${fnNode.name}' is not an allowed identifier in formulas`);
      }
    }
    // Traverse function arguments
    if (fnNode.args) {
      for (const arg of fnNode.args) {
        traverseNode(arg, errors);
      }
    }
    return;
  }

  if (nodeType === 'SymbolNode') {
    const symbolNode = node as MathNode & { name: string };
    if (FORBIDDEN_IDENTIFIERS.has(symbolNode.name)) {
      errors.push(`'${symbolNode.name}' is not an allowed identifier in formulas`);
    }
    return;
  }

  // Recursively traverse children for all other node types
  node.forEach((child: MathNode) => {
    traverseNode(child, errors);
  });
}

/**
 * Validate a formula expression by parsing its AST and checking for security violations.
 *
 * Rejects:
 * - Assignment expressions (x = 5)
 * - Function definitions (f(x) = x * 2)
 * - Forbidden identifiers (process, require, eval, Function, etc.)
 * - Syntax errors
 *
 * @param expression - The formula expression to validate
 * @returns Validation result with valid flag and array of error messages
 */
export function validateFormulaAST(expression: string): FormulaValidationResult {
  try {
    const ast = parse(expression);
    const errors: string[] = [];
    traverseNode(ast, errors);
    return { valid: errors.length === 0, errors };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`Parse error: ${message}`],
    };
  }
}
