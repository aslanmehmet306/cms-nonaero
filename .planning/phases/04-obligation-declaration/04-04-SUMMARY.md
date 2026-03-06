## Plan 04-04 Summary: MAG Settlement + Seed Data

**Status:** ✅ Complete
**Tests:** 10 new (281 total) | **Build:** Clean

### What was built

| Component | Details |
|-----------|---------|
| `settlement.service.ts` | `calculateMonthlyMag` (revenue vs annual_MAG/12, shortfall upsert via lineHash), `calculateYearEndTrueUp` (admin-triggered, nets monthly shortfalls), `findAllEntries` (paginated) |
| `settlement.controller.ts` | `POST /settlement/true-up/:contractId` (finance/admin), `GET /settlement/entries` (paginated with filters) |
| `settlement.module.ts` | Exports `SettlementService` for ObligationsListener DI |
| `obligations.listener.ts` | Added `@OnEvent('obligation.calculated')` handler — triggers `calculateMonthlyMag` only for `revenue_share` chargeType |
| `obligations.module.ts` | Imports `SettlementModule` for SettlementService injection |
| `app.module.ts` | Registered `SettlementModule` |
| `seed.ts` | 3 revenue declarations (Jan-Mar, frozen) + 2 meter readings (Jan-Feb electricity) for CNT-001 |

### Key decisions

- **MAG triggered by `obligation.calculated`** (not `declaration.submitted`) — avoids race condition per Research Pitfall 2
- **Upsert via lineHash** for monthly shortfall — handles re-submitted declarations gracefully
- **Year-end true-up nets monthly shortfalls** — `(annualMag - annualRevShare) - totalMonthlyShortfalls`
- **SettlementEntry created for every calculation** (both shortfall and surplus) for audit trail
- **serviceDefinitionId cast as `null as unknown as string`** — Prisma types not regenerated (Docker unavailable), schema change in 04-01 made it nullable

### Commits

- `7fdb503` feat(04-04): SettlementModule with MAG monthly settlement, year-end true-up, event wiring
- `ae73e46` feat(04-04): seed data with demo declarations + meter readings, plan fixes

### Test coverage

| Test | Result |
|------|--------|
| Monthly MAG creates shortfall when rev < MAG/12 | ✅ |
| No obligation when rev >= monthly MAG | ✅ |
| Skip when no annualMag | ✅ |
| Upsert on re-submission (not duplicate) | ✅ |
| Settlement entry with correct amounts | ✅ |
| Zero revenue = full MAG shortfall | ✅ |
| Year-end: annual covered by monthly shortfalls | ✅ |
| Year-end: no obligation when rev >= MAG | ✅ |
| Year-end: skip when no annualMag | ✅ |
| Year-end: net shortfall after deducting monthlies | ✅ |
