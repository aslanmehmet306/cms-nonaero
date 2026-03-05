---
phase: 02-master-data-formula-engine
plan: 01
subsystem: api
tags: [mathjs, decimal.js, formula-engine, jest, ts-jest, sandbox, security, pricing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "DecimalHelper utility in apps/api/src/common/utils/decimal-helper.ts"
provides:
  - "packages/formula-engine package with sandbox, validator, evaluator, and step-band modules"
  - "limitedEvaluate() — sandboxed math.js expression evaluator with 8 dangerous functions blocked"
  - "validateFormulaAST() — AST traversal rejecting assignments, function definitions, and forbidden identifiers"
  - "evaluateWithTimeout() — timeout-protected evaluation returning Decimal-compatible string results"
  - "evaluateStepBand() — progressive tiered commission calculation using Decimal.js arithmetic"
affects:
  - 02-02
  - 02-03
  - 02-04
  - contract-billing
  - obligation
  - invoice

# Tech tracking
tech-stack:
  added:
    - "mathjs@^13.2.0 — sandboxed math expression evaluation"
    - "decimal.js@^10.4.3 — financial precision arithmetic"
    - "jest@^29.7.0 — test framework"
    - "ts-jest@^29.2.5 — TypeScript Jest transformer"
  patterns:
    - "Sandbox via scope injection: dangerous functions blocked by injecting error-throwing stubs into evaluation scope"
    - "AST traversal security: parse() then traverse MathNode tree checking node types before evaluate()"
    - "Float normalization: toPrecision(15) to eliminate IEEE 754 noise before Decimal wrapping"
    - "Progressive band calculation: Decimal.js arithmetic on each tier, accumulate total"

key-files:
  created:
    - packages/formula-engine/package.json
    - packages/formula-engine/jest.config.ts
    - packages/formula-engine/src/types.ts
    - packages/formula-engine/src/sandbox.ts
    - packages/formula-engine/src/validator.ts
    - packages/formula-engine/src/evaluator.ts
    - packages/formula-engine/src/step-band.ts
    - packages/formula-engine/src/__tests__/sandbox.spec.ts
    - packages/formula-engine/src/__tests__/validator.spec.ts
    - packages/formula-engine/src/__tests__/evaluator.spec.ts
    - packages/formula-engine/src/__tests__/step-band.spec.ts
  modified:
    - packages/formula-engine/src/index.ts

key-decisions:
  - "Sandbox via scope injection, not math instance property override: math.import({ evaluate: blockedFn }) fails because math.js calls evaluate internally; injecting into the expression scope takes priority safely"
  - "Float normalization with toPrecision(15) before Decimal wrapping: math.js uses JavaScript floats (0.1+0.2=0.30000000000000004), normalize first then wrap to achieve 0.3 exactly"
  - "Use mathjs parse() with MathNode.evaluate(scope) instead of math.evaluate(): avoids circular issues when overriding the evaluate function"
  - "Step-band sorts bands by 'from' ascending automatically: callers need not pre-sort"

patterns-established:
  - "Formula security pattern: validate AST first, block dangerous names via scope injection, never raw eval"
  - "Financial precision pattern: always wrap raw number through toPrecision(15) normalization then Decimal.toString() before returning"

requirements-completed: [R3.1, R3.2, R3.3, R3.4]

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 2 Plan 01: Formula Engine Summary

**Math.js sandboxed formula engine with AST security validation, 100ms timeout-protected evaluation, and Decimal.js-wrapped progressive step-band pricing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T10:37:25Z
- **Completed:** 2026-03-05T10:44:05Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Sandboxed math.js instance blocking 8 dangerous functions (import, evaluate, parse, simplify, derivative, resolve, createUnit, reviver) via scope injection
- AST traversal validator rejecting assignments, function definitions, and 13 forbidden identifiers (process, require, eval, Function, etc.)
- Timeout-protected evaluator using Promise.race with 100ms default, returning Decimal-compatible string results
- Step-band progressive tiered commission calculation with automatic band sorting and full Decimal.js arithmetic
- 51 tests pass across 4 test suites with 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Formula Engine types, sandbox, and AST validator with tests** - `73d89c8` (feat)
2. **Task 2: Evaluator with timeout + step-band pricing + barrel export** - `dfa5299` (feat)

## Files Created/Modified
- `packages/formula-engine/package.json` - Added mathjs, decimal.js, jest/ts-jest dependencies
- `packages/formula-engine/jest.config.ts` - ts-jest preset configuration
- `packages/formula-engine/src/types.ts` - FormulaValidationResult, FormulaEvaluationResult, FormulaTrace, Band, FormulaScope interfaces
- `packages/formula-engine/src/sandbox.ts` - createSandbox() and limitedEvaluate() with scope-injection blocking
- `packages/formula-engine/src/validator.ts` - validateFormulaAST() with AST traversal security checks
- `packages/formula-engine/src/evaluator.ts` - evaluateWithTimeout() and evaluateFormula() with timeout and precision wrapping
- `packages/formula-engine/src/step-band.ts` - evaluateStepBand() for progressive tiered pricing
- `packages/formula-engine/src/index.ts` - Barrel export for all public API
- `packages/formula-engine/src/__tests__/sandbox.spec.ts` - 21 sandbox tests
- `packages/formula-engine/src/__tests__/validator.spec.ts` - 10 validator tests
- `packages/formula-engine/src/__tests__/evaluator.spec.ts` - 13 evaluator tests
- `packages/formula-engine/src/__tests__/step-band.spec.ts` - 7 step-band tests

## Decisions Made
- **Scope injection sandbox**: Initial approach of `math.import({ fnName: blockedFn }, { override: true })` failed because math.js internally calls its `evaluate` function, which would also be blocked. Solution: use `parse(expression).evaluate(scope)` where scope contains error-throwing stubs for dangerous function names — scope lookup takes priority over built-in resolution.
- **Float normalization before Decimal wrapping**: `new Decimal(0.30000000000000004)` preserves the float error. Solution: call `toPrecision(15)` then `parseFloat()` first, which trims IEEE 754 noise, then wrap with Decimal.
- **Direct parse() for sandbox**: Using the top-level `parse()` from mathjs (not the sandboxed instance) for AST validation is safe — we only parse, never evaluate in the validator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] math.import override approach for sandbox broke internal evaluate calls**
- **Found during:** Task 1 (sandbox implementation)
- **Issue:** Replacing `math.evaluate` via `math.import({ evaluate: blockedFn }, { override: true })` also blocked internal math.js calls to evaluate (e.g. for comparison operators and ternary), breaking legitimate expressions
- **Fix:** Switched to scope injection approach: use `parse(expression).evaluate(scope)` where scope contains error-throwing stubs for each dangerous function name
- **Files modified:** `packages/formula-engine/src/sandbox.ts`
- **Verification:** All 21 sandbox tests pass including ternary and comparison operators
- **Committed in:** 73d89c8 (Task 1 commit)

**2. [Rule 1 - Bug] 0.1 + 0.2 returned "0.30000000000000004" not "0.3"**
- **Found during:** Task 2 (evaluator precision test)
- **Issue:** `new Decimal(0.30000000000000004).toString()` = "0.30000000000000004" because Decimal preserves the float value as-is
- **Fix:** Normalize float through `toPrecision(15)` then `parseFloat()` before Decimal wrapping, which trims IEEE 754 floating-point noise to get exactly 0.3
- **Files modified:** `packages/formula-engine/src/evaluator.ts`
- **Verification:** "0.1 + 0.2" evaluates to "0.3" in test
- **Committed in:** dfa5299 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes were essential for correctness. No scope creep.

## Issues Encountered
- None beyond the two auto-fixed bugs documented above.

## User Setup Required
None - no external service configuration required. This is a pure TypeScript package with no external dependencies.

## Next Phase Readiness
- Formula engine package fully functional and tested: 51/51 tests pass, 0 TypeScript errors
- Public API exported from index.ts: createSandbox, limitedEvaluate, validateFormulaAST, evaluateWithTimeout, evaluateFormula, evaluateStepBand
- Ready for use by 02-02 (Lease/Space CRUD), 02-03 (Tenant CRUD), and 02-04 (Formula CRUD API) plans
- Formula CRUD API (02-04) can import from `@airport-revenue/formula-engine` to validate and test formulas

---
*Phase: 02-master-data-formula-engine*
*Completed: 2026-03-05*
