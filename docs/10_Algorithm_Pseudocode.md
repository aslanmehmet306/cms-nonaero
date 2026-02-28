# ⚙️ ALGORITHM PSEUDO-CODE
## Core Business Logic Implementations

**Version:** v1.0
**Last Updated:** 2026-02-28
**Purpose:** Backend developer'ın doğrudan implement edebileceği seviyede algoritma tanımları
**Decisions Applied:** Proration aktif, Band'ler expression-based, Local file storage

---

## 1. OBLIGATION SCHEDULE GENERATION

### 1.1 Trigger
Contract status `Published` olduğunda çalışır. Tek entry point:

```
function generateObligationSchedule(contract: Contract): Obligation[]
```

### 1.2 Algorithm

```pseudo
FUNCTION generateObligationSchedule(contract):

  billingPolicy = getActiveBillingPolicy(contract.airportId)
  obligations = []

  // === STEP 1: Period Boundaries Hesapla ===
  periods = generatePeriods(
    contract.effectiveFrom,
    contract.effectiveTo,
    contract.billingFrequency  // monthly | quarterly | annually
  )

  // === STEP 2: Her Service İçin Obligation Üret ===
  FOR EACH contractService IN contract.contractServices:
    serviceDef = contractService.serviceDefinition
    formula = contractService.overrideFormula ?? serviceDef.formula
    chargeType = mapServiceTypeToChargeType(serviceDef.serviceType)

    FOR EACH period IN periods:
      obligation = createObligation(contract, contractService, period, billingPolicy, formula, chargeType)
      obligations.push(obligation)
    END FOR
  END FOR

  // === STEP 3: MAG Year-End True-Up Obligation ===
  IF contract.annualMag IS NOT NULL:
    magTrueUpObligation = createMagTrueUpObligation(contract, billingPolicy)
    obligations.push(magTrueUpObligation)
  END IF

  // === STEP 4: line_hash & Duplicate Check ===
  FOR EACH obligation IN obligations:
    obligation.lineHash = computeLineHash(obligation)
    IF existsInDB(obligation.lineHash):
      THROW DuplicateObligationError(obligation.lineHash)
    END IF
  END FOR

  // === STEP 5: Bulk Insert ===
  bulkInsert(obligations)

  // === STEP 6: Audit Log ===
  auditLog("obligation_schedule_generated", contract.id, {
    obligationCount: obligations.length,
    periodCount: periods.length,
    firstPeriod: periods[0],
    lastPeriod: periods[periods.length - 1]
  })

  // === STEP 7: Notification ===
  notify(contract.responsibleOwner, "obligation_schedule_generated", { contractId: contract.id })

  RETURN obligations
END FUNCTION
```

### 1.3 Period Generation (with Proration)

```pseudo
FUNCTION generatePeriods(effectiveFrom, effectiveTo, frequency):
  periods = []

  // === FIRST PERIOD: Proration Check ===
  IF frequency == "monthly":
    firstDayOfMonth = startOfMonth(effectiveFrom)

    IF effectiveFrom > firstDayOfMonth:
      // Mid-month start → proration period
      prorationPeriod = {
        start: effectiveFrom,
        end: endOfMonth(effectiveFrom),
        isProrated: true,
        daysInPeriod: daysBetween(effectiveFrom, endOfMonth(effectiveFrom)) + 1,
        daysInFullPeriod: daysInMonth(effectiveFrom)
      }
      periods.push(prorationPeriod)

      // Next full period starts from next month 1st
      currentDate = startOfNextMonth(effectiveFrom)
    ELSE:
      // Starts on 1st → no proration needed
      currentDate = effectiveFrom
    END IF

    // === FULL PERIODS ===
    WHILE currentDate <= effectiveTo:
      periodEnd = min(endOfMonth(currentDate), effectiveTo)

      period = {
        start: currentDate,
        end: periodEnd,
        isProrated: periodEnd < endOfMonth(currentDate),  // last period might be partial
        daysInPeriod: daysBetween(currentDate, periodEnd) + 1,
        daysInFullPeriod: daysInMonth(currentDate)
      }
      periods.push(period)

      currentDate = startOfNextMonth(currentDate)
    END WHILE

  ELSE IF frequency == "quarterly":
    // Quarter boundaries: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
    // First quarter may be prorated
    quarterEnd = endOfQuarter(effectiveFrom)

    IF effectiveFrom > startOfQuarter(effectiveFrom):
      prorationPeriod = {
        start: effectiveFrom,
        end: quarterEnd,
        isProrated: true,
        daysInPeriod: daysBetween(effectiveFrom, quarterEnd) + 1,
        daysInFullPeriod: daysBetween(startOfQuarter(effectiveFrom), quarterEnd) + 1
      }
      periods.push(prorationPeriod)
      currentDate = startOfNextQuarter(effectiveFrom)
    ELSE:
      currentDate = effectiveFrom
    END IF

    WHILE currentDate <= effectiveTo:
      periodEnd = min(endOfQuarter(currentDate), effectiveTo)
      period = {
        start: currentDate,
        end: periodEnd,
        isProrated: periodEnd < endOfQuarter(currentDate),
        daysInPeriod: daysBetween(currentDate, periodEnd) + 1,
        daysInFullPeriod: daysBetween(startOfQuarter(currentDate), endOfQuarter(currentDate)) + 1
      }
      periods.push(period)
      currentDate = startOfNextQuarter(currentDate)
    END WHILE

  ELSE IF frequency == "annually":
    // Annual: fiscal year based
    // First year may be prorated
    currentDate = effectiveFrom
    WHILE currentDate <= effectiveTo:
      yearEnd = min(addYears(effectiveFrom, 1) - 1 day, effectiveTo)
      period = {
        start: currentDate,
        end: yearEnd,
        isProrated: daysBetween(currentDate, yearEnd) + 1 < 365,
        daysInPeriod: daysBetween(currentDate, yearEnd) + 1,
        daysInFullPeriod: isLeapYear(currentDate) ? 366 : 365
      }
      periods.push(period)
      currentDate = yearEnd + 1 day
    END WHILE
  END IF

  RETURN periods
END FUNCTION
```

### 1.4 Obligation Creation (Per Service Per Period)

```pseudo
FUNCTION createObligation(contract, contractService, period, billingPolicy, formula, chargeType):

  serviceDef = contractService.serviceDefinition

  // === Determine Obligation Type & Initial Status ===
  SWITCH serviceDef.serviceType:
    CASE "rent":
      obligationType = "rent"
      // Rent amount can be calculated immediately
      variables = buildRentVariables(contract, contractService, period)
      calcResult = evaluateFormula(formula.expression, variables)

      IF period.isProrated:
        // Apply proration factor
        calcResult.amount = calcResult.amount * period.daysInPeriod / period.daysInFullPeriod
      END IF

      amount = roundHalfUp(calcResult.amount, 2)
      status = "scheduled"
      calculationTrace = calcResult.trace

    CASE "revenue_share":
      obligationType = "revenue_share"
      // Amount depends on declaration → unknown at schedule time
      amount = NULL
      status = "pending_input"
      calculationTrace = NULL

    CASE "service_charge":
      obligationType = "rent"  // treated same as rent for billing
      variables = buildServiceChargeVariables(contract, contractService, period)
      calcResult = evaluateFormula(formula.expression, variables)

      IF period.isProrated:
        calcResult.amount = calcResult.amount * period.daysInPeriod / period.daysInFullPeriod
      END IF

      amount = roundHalfUp(calcResult.amount, 2)
      status = "scheduled"
      calculationTrace = calcResult.trace
  END SWITCH

  // === Due Date Calculation ===
  dueDate = calculateDueDate(period, billingPolicy, serviceDef.serviceType)

  // === Tax Rate ===
  taxRate = getTaxRate(serviceDef.taxClass)  // 20, 10, 1, 0

  RETURN {
    airportId: contract.airportId,
    contractId: contract.id,
    contractVersion: contract.version,
    tenantId: contract.tenantId,
    serviceDefinitionId: serviceDef.id,
    obligationType: obligationType,
    chargeType: chargeType,
    periodStart: period.start,
    periodEnd: period.end,
    dueDate: dueDate,
    amount: amount,
    currency: contract.magCurrency ?? "TRY",
    status: status,
    formulaVersion: formula.version,
    calculationTrace: calculationTrace,
    invoiceProvider: "stripe",
    taxRate: taxRate
  }
END FUNCTION
```

### 1.5 Due Date Calculation

```pseudo
FUNCTION calculateDueDate(period, billingPolicy, serviceType):

  IF serviceType == "rent":
    // Rent is prepaid → due at period START
    // Due date = period start month's issue day
    dueDate = setDay(period.start, billingPolicy.issueDay)
    IF dueDate < period.start:
      dueDate = period.start  // can't be before period starts
    END IF

  ELSE IF serviceType == "revenue_share":
    // Revenue share is postpaid → due AFTER cut-off
    // Due date = cut-off day + due_date_days
    cutOffDate = setDay(addMonths(period.end, 1), billingPolicy.cutOffDay)
    dueDate = addDays(cutOffDate, billingPolicy.dueDateDays)

  ELSE:
    // Default: period end + due_date_days
    dueDate = addDays(period.end, billingPolicy.dueDateDays)
  END IF

  // Skip weekends (move to next Monday)
  WHILE isWeekend(dueDate):
    dueDate = addDays(dueDate, 1)
  END WHILE

  RETURN dueDate
END FUNCTION
```

### 1.6 MAG True-Up Obligation

```pseudo
FUNCTION createMagTrueUpObligation(contract, billingPolicy):

  fiscalYearStart = getFiscalYearStart(billingPolicy.fiscalYearStartMonth, contract.effectiveFrom)
  fiscalYearEnd = addYears(fiscalYearStart, 1) - 1 day

  // Clamp to contract dates
  trueUpPeriodStart = max(contract.effectiveFrom, fiscalYearStart)
  trueUpPeriodEnd = min(contract.effectiveTo, fiscalYearEnd)

  // Due date: fiscal year end + due_date_days + buffer (e.g., 45 days for year-end processing)
  trueUpDueDate = addDays(trueUpPeriodEnd, billingPolicy.dueDateDays + 15)

  RETURN {
    airportId: contract.airportId,
    contractId: contract.id,
    contractVersion: contract.version,
    tenantId: contract.tenantId,
    serviceDefinitionId: NULL,  // MAG is contract-level, not service-level
    obligationType: "mag_true_up",
    chargeType: "mag_settlement",
    periodStart: trueUpPeriodStart,
    periodEnd: trueUpPeriodEnd,
    dueDate: trueUpDueDate,
    amount: NULL,  // Calculated at year-end
    currency: contract.magCurrency ?? "TRY",
    status: "pending_calculation",
    formulaVersion: NULL,
    calculationTrace: NULL,
    invoiceProvider: "stripe",
    taxRate: getTaxRate("standard")  // MAG settlement follows standard tax
  }
END FUNCTION
```

### 1.7 line_hash Computation

```pseudo
FUNCTION computeLineHash(obligation):
  // Deterministic hash for duplicate detection
  input = concatenate(
    obligation.contractId,
    obligation.contractVersion.toString(),
    obligation.serviceDefinitionId ?? "MAG",
    obligation.obligationType,
    obligation.chargeType,
    obligation.periodStart.toISOString(),
    obligation.periodEnd.toISOString()
  )
  RETURN sha256(input)
END FUNCTION
```

### 1.8 Formula Variable Building

```pseudo
FUNCTION buildRentVariables(contract, contractService, period):
  // Get area info from contract
  contractAreas = contract.contractAreas
  totalAreaM2 = sum(contractAreas.map(ca => ca.area.areaM2))

  customParams = contractService.customParameters ?? {}

  RETURN {
    area_m2: totalAreaM2,
    rate_per_m2: customParams.rate_per_m2 ?? 0,
    days_in_period: period.daysInPeriod,
    days_in_year: isLeapYear(period.start) ? 366 : 365,
    base_amount: customParams.base_amount ?? 0,
    monthly_rent: customParams.monthly_rent ?? 0,
    annual_amount: customParams.annual_amount ?? 0,
    index_rate: customParams.index_rate ?? 0
  }
END FUNCTION

FUNCTION buildRevenueShareVariables(declaration, contractService):
  // Called when declaration is frozen (not at schedule time)
  totalGrossAmount = sum(declaration.lines.map(l => l.grossAmount))
  customParams = contractService.customParameters ?? {}

  RETURN {
    sales_amount: totalGrossAmount,  // KDV dahil brüt satış
    share_rate: customParams.share_rate ?? 0,
    // Band thresholds injected into formula expression directly
    // e.g., if(sales_amount <= 500000, sales_amount * 0.08, ...)
  }
END FUNCTION
```

---

## 2. MAG SETTLEMENT ALGORITHM

### 2.1 Monthly Settlement (Higher-Of)

```pseudo
FUNCTION calculateMonthlyMagSettlement(contract, period):

  annualMag = contract.annualMag
  IF annualMag IS NULL OR annualMag == 0:
    RETURN NULL  // No MAG on this contract
  END IF

  monthlyMag = annualMag / 12

  // === Get Revenue Share for This Period ===
  revenueShareObligations = getObligations(
    contractId: contract.id,
    chargeType: "revenue_share",
    periodStart: period.start,
    periodEnd: period.end,
    status: IN ["ready", "invoiced", "settled"]
  )

  totalRevenueShare = sum(revenueShareObligations.map(o => o.amount))

  // === Higher-Of Comparison ===
  // CRITICAL: No carry-forward. Each month independent.
  higherOfResult = max(totalRevenueShare, monthlyMag)
  shortfall = max(0, monthlyMag - totalRevenueShare)
  surplus = max(0, totalRevenueShare - monthlyMag)

  // === Create Settlement Entry ===
  settlementEntry = {
    airportId: contract.airportId,
    contractId: contract.id,
    tenantId: contract.tenantId,
    periodStart: period.start,
    periodEnd: period.end,
    settlementType: "monthly_mag",
    revenueShareAmount: totalRevenueShare,
    magAmount: monthlyMag,
    higherOfResult: higherOfResult,
    shortfall: shortfall,
    surplus: surplus,
    trueUpAmount: 0  // Monthly does not create true-up
  }

  // === If Shortfall → Create MAG Shortfall Obligation ===
  IF shortfall > 0:
    magShortfallObligation = {
      contractId: contract.id,
      tenantId: contract.tenantId,
      obligationType: "mag_shortfall",
      chargeType: "mag_settlement",
      periodStart: period.start,
      periodEnd: period.end,
      amount: shortfall,
      status: "ready",  // Immediately ready for billing
      // ... other fields
    }
    insert(magShortfallObligation)
  END IF

  insert(settlementEntry)

  // === Notification ===
  IF shortfall > 0:
    notify("finance", "mag_shortfall", {
      contractId: contract.id,
      tenantId: contract.tenantId,
      shortfall: shortfall,
      period: period
    })
  END IF

  RETURN settlementEntry
END FUNCTION
```

### 2.2 Year-End True-Up

```pseudo
FUNCTION calculateYearEndMagTrueUp(contract, fiscalYear):

  annualMag = contract.annualMag
  IF annualMag IS NULL OR annualMag == 0:
    RETURN NULL
  END IF

  fiscalYearStart = getFiscalYearStart(fiscalYear)
  fiscalYearEnd = getFiscalYearEnd(fiscalYear)

  // Clamp to contract dates
  effectiveStart = max(contract.effectiveFrom, fiscalYearStart)
  effectiveEnd = min(contract.effectiveTo, fiscalYearEnd)

  // === Pro-rate MAG if contract doesn't cover full fiscal year ===
  totalFiscalDays = daysBetween(fiscalYearStart, fiscalYearEnd) + 1
  contractDays = daysBetween(effectiveStart, effectiveEnd) + 1
  proratedMag = annualMag * contractDays / totalFiscalDays

  // === YTD Revenue Share ===
  ytdRevenueShareObligations = getObligations(
    contractId: contract.id,
    chargeType: "revenue_share",
    periodStart: >= effectiveStart,
    periodEnd: <= effectiveEnd,
    status: IN ["ready", "invoiced", "settled"]
  )
  ytdRevenueShare = sum(ytdRevenueShareObligations.map(o => o.amount))

  // === YTD MAG Already Billed (monthly shortfalls) ===
  ytdMagBilled = sum(getSettlementEntries(
    contractId: contract.id,
    periodStart: >= effectiveStart,
    periodEnd: <= effectiveEnd,
    settlementType: "monthly_mag"
  ).map(s => s.higherOfResult))

  // === True-Up Calculation ===
  // Total that should have been billed = max(ytdRevenueShare, proratedMag)
  totalShouldBeBilled = max(ytdRevenueShare, proratedMag)

  // Already billed through monthly settlements
  alreadyBilled = ytdMagBilled

  // True-up = difference
  trueUpAmount = totalShouldBeBilled - alreadyBilled

  // === Create Settlement Entry ===
  settlementEntry = {
    airportId: contract.airportId,
    contractId: contract.id,
    tenantId: contract.tenantId,
    periodStart: effectiveStart,
    periodEnd: effectiveEnd,
    settlementType: "year_end_true_up",
    revenueShareAmount: ytdRevenueShare,
    magAmount: proratedMag,
    higherOfResult: totalShouldBeBilled,
    shortfall: max(0, proratedMag - ytdRevenueShare),
    surplus: max(0, ytdRevenueShare - proratedMag),
    trueUpAmount: trueUpAmount
  }

  // === If True-Up > 0 → Update MAG True-Up Obligation ===
  IF trueUpAmount > 0:
    magTrueUpObligation = getObligation(
      contractId: contract.id,
      obligationType: "mag_true_up",
      periodStart: effectiveStart,
      periodEnd: effectiveEnd
    )

    IF magTrueUpObligation:
      magTrueUpObligation.amount = roundHalfUp(trueUpAmount, 2)
      magTrueUpObligation.status = "ready"
      magTrueUpObligation.calculationTrace = {
        proratedMag: proratedMag,
        ytdRevenueShare: ytdRevenueShare,
        ytdMagBilled: alreadyBilled,
        trueUpAmount: trueUpAmount
      }
      update(magTrueUpObligation)
    END IF
  ELSE:
    // Surplus or exact match → cancel the true-up obligation
    magTrueUpObligation = getObligation(
      contractId: contract.id,
      obligationType: "mag_true_up"
    )
    IF magTrueUpObligation AND magTrueUpObligation.status == "pending_calculation":
      magTrueUpObligation.status = "cancelled"
      magTrueUpObligation.skippedReason = "No shortfall at year-end"
      update(magTrueUpObligation)
    END IF
  END IF

  insert(settlementEntry)
  RETURN settlementEntry
END FUNCTION
```

---

## 3. BILLING RUN ORCHESTRATOR

### 3.1 Main Billing Run Flow

```pseudo
FUNCTION executeBillingRun(billingRunId):

  run = getBillingRun(billingRunId)

  TRY:
    // === PHASE 1: SCOPING ===
    run.status = "scoping"
    update(run)

    // Take contract snapshot
    run.contractSnapshot = takeContractSnapshot(run.airportId, run.filters)

    // Collect eligible obligations
    eligibleObligations = collectEligibleObligations(run)

    IF eligibleObligations.length == 0:
      run.status = "completed"
      run.totalObligations = 0
      update(run)
      RETURN
    END IF

    // === PHASE 2: CALCULATING ===
    run.status = "calculating"
    update(run)

    calculatedObligations = []
    FOR EACH obligation IN eligibleObligations:
      // For revenue_share: declaration should already be frozen, amount calculated
      // For rent/scheduled: amount already set at schedule time
      // Verify calculation is still valid using snapshot
      verified = verifyObligationWithSnapshot(obligation, run.contractSnapshot)
      IF verified:
        calculatedObligations.push(obligation)
      ELSE:
        logWarning("Obligation {obligation.id} snapshot mismatch, skipping")
      END IF
    END FOR

    // === PHASE 3: DRAFT READY ===
    run.status = "draft_ready"
    run.totalObligations = calculatedObligations.length
    run.totalAmount = sum(calculatedObligations.map(o => o.amount))
    run.totalInvoices = countInvoicesToCreate(calculatedObligations)
    update(run)

    // Notify admin for review
    notify("finance", "billing_run_draft_ready", { runId: run.id })

    // === WAIT FOR APPROVAL (handled by separate API call) ===

  CATCH error:
    run.status = "cancelled"
    run.errorLog = { message: error.message, stack: error.stack }
    update(run)
    notify("finance", "billing_run_failed", { runId: run.id, error: error.message })
  END TRY
END FUNCTION
```

### 3.2 Eligible Obligation Collection

```pseudo
FUNCTION collectEligibleObligations(run):

  query = {
    airportId: run.airportId,
    status: "ready",
    periodStart: >= run.periodStart,
    periodEnd: <= run.periodEnd
  }

  // Apply filters
  IF run.filters.charge_types:
    query.chargeType = IN run.filters.charge_types
  END IF

  IF run.filters.tenant_ids:
    query.tenantId = IN run.filters.tenant_ids
  END IF

  IF run.filters.zone_codes:
    // Join through contract → contractAreas → area
    query.area.code = IN run.filters.zone_codes
  END IF

  // === Delta Mode: Only New/Changed ===
  IF run.runMode == "delta" AND run.previousRunId:
    previousRun = getBillingRun(run.previousRunId)
    previousObligationIds = getObligationIdsForRun(previousRun.id)
    query.id = NOT IN previousObligationIds
  END IF

  obligations = findObligations(query)

  // Link obligations to this billing run
  FOR EACH obligation IN obligations:
    obligation.billingRunId = run.id
    update(obligation)
  END FOR

  RETURN obligations
END FUNCTION
```

### 3.3 Invoice Creation (Post-Approval)

```pseudo
FUNCTION processApprovedBillingRun(billingRunId):

  run = getBillingRun(billingRunId)
  run.status = "invoicing"
  update(run)

  // Group obligations by tenant + charge_type → 1 invoice per group
  groups = groupBy(run.obligations, o => `${o.tenantId}_${o.chargeType}`)

  successCount = 0
  failCount = 0

  FOR EACH (groupKey, obligations) IN groups:
    // Queue each invoice as separate BullMQ job
    queueJob("stripe-invoice", {
      billingRunId: run.id,
      tenantId: obligations[0].tenantId,
      chargeType: obligations[0].chargeType,
      obligationIds: obligations.map(o => o.id),
      idempotencyKey: `${run.id}_${obligations[0].chargeType}_${obligations[0].tenantId}`
    })
  END FOR

  // Worker processes each job (see 3.4)
END FUNCTION
```

### 3.4 Stripe Invoice Worker

```pseudo
FUNCTION stripeInvoiceWorker(job):

  { billingRunId, tenantId, chargeType, obligationIds, idempotencyKey } = job.data

  tenant = getTenant(tenantId)
  obligations = getObligations(obligationIds)
  billingPolicy = getActiveBillingPolicy(obligations[0].airportId)

  TRY:
    // === Step 1: Create Stripe Invoice ===
    stripeInvoice = stripe.invoices.create({
      customer: tenant.stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: billingPolicy.dueDateDays,
      currency: "try",
      auto_advance: true,
      metadata: {
        airport_id: obligations[0].airportId,
        billing_run_id: billingRunId,
        contract_id: obligations[0].contractId,
        charge_type: chargeType,
        period: formatPeriod(obligations[0].periodStart)
      }
    }, {
      idempotencyKey: idempotencyKey
    })

    // === Step 2: Add Line Items ===
    FOR EACH obligation IN obligations:
      stripe.invoiceItems.create({
        customer: tenant.stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: toStripeCents(obligation.amount),  // Stripe uses minor units
        currency: "try",
        description: buildLineDescription(obligation),
        metadata: {
          obligation_id: obligation.id,
          service_id: obligation.serviceDefinitionId,
          formula_version: obligation.formulaVersion?.toString(),
          area_code: getAreaCode(obligation)
        }
      })
    END FOR

    // === Step 3: Finalize ===
    stripe.invoices.finalizeInvoice(stripeInvoice.id)

    // === Step 4: Create Local Invoice Log ===
    invoiceLog = createInvoiceLog({
      airportId: obligations[0].airportId,
      billingRunId: billingRunId,
      tenantId: tenantId,
      chargeType: chargeType,
      stripeInvoiceId: stripeInvoice.id,
      stripeInvoiceNumber: stripeInvoice.number,
      stripeHostedUrl: stripeInvoice.hosted_invoice_url,
      stripePdfUrl: stripeInvoice.invoice_pdf,
      status: "finalized",
      amountTotal: fromStripeCents(stripeInvoice.amount_due),
      currency: "TRY",
      dueDate: fromStripeTimestamp(stripeInvoice.due_date),
      idempotencyKey: idempotencyKey
    })

    // === Step 5: Update Obligations ===
    FOR EACH obligation IN obligations:
      obligation.status = "invoiced"
      obligation.invoiceLogId = invoiceLog.id
      obligation.invoicedAt = now()
      obligation.externalInvoiceId = stripeInvoice.id
      update(obligation)
    END FOR

  CATCH stripeError:
    // Log error, BullMQ will retry based on config
    logError("Stripe invoice creation failed", {
      billingRunId,
      tenantId,
      chargeType,
      error: stripeError.message
    })
    THROW stripeError  // Let BullMQ retry
  END TRY
END FUNCTION
```

### 3.5 Contract Snapshot

```pseudo
FUNCTION takeContractSnapshot(airportId, filters):

  contracts = getActiveContracts(airportId, filters.tenant_ids)

  snapshot = {}
  FOR EACH contract IN contracts:
    snapshot[contract.id] = {
      version: contract.version,
      effectiveFrom: contract.effectiveFrom,
      effectiveTo: contract.effectiveTo,
      annualMag: contract.annualMag,
      services: contract.contractServices.map(cs => ({
        serviceId: cs.serviceDefinitionId,
        formulaId: cs.overrideFormulaId ?? cs.serviceDefinition.formulaId,
        formulaVersion: (cs.overrideFormula ?? cs.serviceDefinition.formula).version,
        customParameters: cs.customParameters
      }))
    }
  END FOR

  RETURN snapshot
END FUNCTION
```

### 3.6 Tenant-Level Partial Cancel

```pseudo
FUNCTION cancelBillingRunForTenants(billingRunId, tenantIds, reason):

  run = getBillingRun(billingRunId)

  IF run.status NOT IN ["draft_ready", "invoicing", "partial"]:
    THROW InvalidStateError("Can only cancel from draft_ready, invoicing, or partial states")
  END IF

  cancelledObligations = 0
  cancelledInvoices = 0

  FOR EACH tenantId IN tenantIds:
    // === Cancel Obligations ===
    tenantObligations = getObligations(
      billingRunId: run.id,
      tenantId: tenantId,
      status: IN ["ready", "invoiced"]
    )

    FOR EACH obligation IN tenantObligations:
      IF obligation.status == "invoiced" AND obligation.invoiceLog:
        // Void Stripe invoice
        TRY:
          stripe.invoices.voidInvoice(obligation.invoiceLog.stripeInvoiceId)
          obligation.invoiceLog.status = "voided"
          obligation.invoiceLog.voidedAt = now()
          update(obligation.invoiceLog)
          cancelledInvoices++
        CATCH:
          logWarning("Could not void Stripe invoice", { invoiceId: obligation.invoiceLog.stripeInvoiceId })
        END TRY
      END IF

      obligation.status = "ready"  // Back to ready, available for next run
      obligation.billingRunId = NULL
      obligation.invoiceLogId = NULL
      obligation.invoicedAt = NULL
      update(obligation)
      cancelledObligations++
    END FOR
  END FOR

  // Check if all obligations cancelled → cancel entire run
  remainingActive = countObligations(billingRunId: run.id, status: NOT IN ["ready"])
  IF remainingActive == 0:
    run.status = "cancelled"
  END IF

  update(run)

  auditLog("billing_run_partial_cancel", run.id, {
    tenantIds,
    reason,
    cancelledObligations,
    cancelledInvoices
  })

  RETURN { cancelledObligations, cancelledInvoices, remainingActive }
END FUNCTION
```

---

## 4. DECLARATION → OBLIGATION FLOW

### 4.1 Declaration Submission & Validation

```pseudo
FUNCTION submitDeclaration(declarationId):

  declaration = getDeclaration(declarationId)

  // === Validation Rules ===
  errors = []
  warnings = []

  FOR EACH line IN declaration.lines:
    // Rule 1: Negative amount → REJECT
    IF line.grossAmount < 0:
      errors.push({ line: line.id, rule: "negative_amount", message: "Negatif satış tutarı" })
    END IF

    // Rule 2: Zero amount → WARNING
    IF line.grossAmount == 0:
      warnings.push({ line: line.id, rule: "zero_amount", message: "Sıfır satış tutarı" })
    END IF

    // Rule 3: >50% deviation from previous month → WARNING
    previousDeclaration = getPreviousMonthDeclaration(declaration.tenantId, declaration.contractId, line.category)
    IF previousDeclaration:
      prevAmount = previousDeclaration.grossAmount
      IF prevAmount > 0:
        deviation = abs(line.grossAmount - prevAmount) / prevAmount
        IF deviation > 0.50:
          warnings.push({
            line: line.id,
            rule: "high_deviation",
            message: "Önceki aya göre %${round(deviation*100)} sapma",
            previousAmount: prevAmount
          })
        END IF
      END IF
    END IF
  END FOR

  // Rule 4: Duplicate check
  existingDeclaration = findDeclaration(
    tenantId: declaration.tenantId,
    contractId: declaration.contractId,
    periodStart: declaration.periodStart,
    periodEnd: declaration.periodEnd,
    status: NOT IN ["draft", "rejected"]
  )
  IF existingDeclaration AND existingDeclaration.id != declaration.id:
    errors.push({ rule: "duplicate", message: "Bu dönem için zaten bir beyan mevcut" })
  END IF

  // Rule 5: Currency check (Phase 1: TRY only)
  // Enforced at DB level

  // === Result ===
  IF errors.length > 0:
    declaration.status = "rejected"
    update(declaration)
    RETURN { success: false, errors, warnings }
  END IF

  declaration.status = "validated"
  declaration.submittedAt = now()
  update(declaration)

  RETURN { success: true, errors: [], warnings }
END FUNCTION
```

### 4.2 Cut-Off Enforcement (Cron Job)

```pseudo
// Runs daily at 00:05 UTC
FUNCTION enforceCutOff():

  billingPolicies = getAllActiveBillingPolicies()

  FOR EACH policy IN billingPolicies:
    today = currentDate(policy.airport.timezone)
    cutOffDate = setDay(today, policy.cutOffDay)

    // === 3 Days Before Cut-Off: Send Reminder ===
    IF today == subtractDays(cutOffDate, 3):
      pendingDeclarations = findMissingDeclarations(
        airportId: policy.airportId,
        period: getPreviousPeriod(today),
        status: NOT IN ["validated", "frozen"]
      )

      FOR EACH missing IN pendingDeclarations:
        notify(missing.tenantId, "cutoff_approaching", {
          daysRemaining: 3,
          period: missing.period,
          cutOffDate: cutOffDate
        })
      END FOR
    END IF

    // === Cut-Off Day: Freeze & Skip ===
    IF today == cutOffDate:
      period = getPreviousPeriod(today)

      // Freeze validated declarations
      validatedDeclarations = findDeclarations(
        airportId: policy.airportId,
        periodStart: period.start,
        periodEnd: period.end,
        status: "validated"
      )

      FOR EACH declaration IN validatedDeclarations:
        declaration.status = "frozen"
        declaration.frozenAt = now()
        declaration.frozenToken = generateToken()
        update(declaration)

        // === Trigger Revenue Share Obligation Calculation ===
        calculateRevenueShareObligation(declaration)
      END FOR

      // Handle missing declarations
      missingObligations = findObligations(
        airportId: policy.airportId,
        chargeType: "revenue_share",
        periodStart: period.start,
        periodEnd: period.end,
        status: "pending_input"
      )

      // Check which have no frozen declaration
      FOR EACH obligation IN missingObligations:
        hasFrozenDeclaration = existsDeclaration(
          contractId: obligation.contractId,
          tenantId: obligation.tenantId,
          periodStart: period.start,
          periodEnd: period.end,
          status: "frozen"
        )

        IF NOT hasFrozenDeclaration:
          obligation.status = "skipped"
          obligation.skippedAt = now()
          obligation.skippedReason = "Declaration missing at cut-off"
          update(obligation)

          // Alert tenant + commercial manager
          notify(obligation.tenantId, "declaration_missing", {
            period: period,
            chargeType: obligation.chargeType,
            contractId: obligation.contractId
          })

          notify(getCommercialManager(obligation.contractId), "declaration_missing", {
            tenantId: obligation.tenantId,
            period: period
          })
        END IF
      END FOR
    END IF
  END FOR
END FUNCTION
```

### 4.3 Revenue Share Obligation Calculation

```pseudo
FUNCTION calculateRevenueShareObligation(declaration):

  // Find matching pending_input obligation
  obligation = findObligation(
    contractId: declaration.contractId,
    tenantId: declaration.tenantId,
    chargeType: "revenue_share",
    periodStart: declaration.periodStart,
    periodEnd: declaration.periodEnd,
    status: "pending_input"
  )

  IF NOT obligation:
    logWarning("No pending revenue share obligation found for declaration", { declarationId: declaration.id })
    RETURN
  END IF

  // Get contract service for revenue share
  contract = getContract(declaration.contractId)
  revenueShareService = contract.contractServices.find(
    cs => cs.serviceDefinition.serviceType == "revenue_share"
  )

  IF NOT revenueShareService:
    logError("Contract has no revenue_share service", { contractId: contract.id })
    RETURN
  END IF

  // Build variables from declaration
  formula = revenueShareService.overrideFormula ?? revenueShareService.serviceDefinition.formula
  variables = buildRevenueShareVariables(declaration, revenueShareService)

  // Evaluate formula
  calcResult = evaluateFormula(formula.expression, variables)

  // Update obligation
  obligation.amount = roundHalfUp(calcResult.amount, 2)
  obligation.status = "ready"
  obligation.formulaVersion = formula.version
  obligation.calculationTrace = calcResult.trace
  obligation.sourceDeclarationId = declaration.id
  update(obligation)

  auditLog("obligation_calculated", obligation.id, {
    declarationId: declaration.id,
    formula: formula.expression,
    variables: variables,
    result: calcResult.amount,
    trace: calcResult.trace
  })
END FUNCTION
```

---

## 5. CONTRACT LIFECYCLE TRANSITIONS

### 5.1 Published → Active Transition

**Mechanism: Hybrid (Cron + API-time check)**

```pseudo
// === CRON JOB: Daily at 00:10 UTC ===
FUNCTION activatePublishedContracts():

  today = currentDate()

  publishedContracts = findContracts(
    status: "published",
    signedAt: IS NOT NULL,
    effectiveFrom: <= today
  )

  FOR EACH contract IN publishedContracts:
    contract.status = "active"
    update(contract)

    auditLog("contract_activated", contract.id, {
      activatedBy: "system_cron",
      signedAt: contract.signedAt,
      effectiveFrom: contract.effectiveFrom
    })

    notify(contract.responsibleOwner, "contract_activated", {
      contractId: contract.id,
      tenantId: contract.tenantId
    })
  END FOR
END FUNCTION

// === API-TIME CHECK (supplementary) ===
// When contract is fetched via API, check if it should be active
FUNCTION getContractWithStatusCheck(contractId):
  contract = getContract(contractId)

  IF contract.status == "published"
     AND contract.signedAt IS NOT NULL
     AND contract.effectiveFrom <= currentDate():
    contract.status = "active"
    update(contract)
  END IF

  RETURN contract
END FUNCTION
```

### 5.2 Amendment Flow

```pseudo
FUNCTION initiateAmendment(contractId, amendmentType, effectiveFrom, reason):

  originalContract = getContract(contractId)

  // Validation
  IF originalContract.status != "active":
    THROW InvalidStateError("Only active contracts can be amended")
  END IF

  // Effective date must be next full period start
  IF effectiveFrom != startOfNextMonth(currentDate()):
    IF effectiveFrom < startOfNextMonth(currentDate()):
      THROW ValidationError("Amendment effective date must be next full period start or later")
    END IF
  END IF

  // === Step 1: Mark Original as Amended ===
  originalContract.status = "amended"
  update(originalContract)

  // === Step 2: Cancel Future Obligations ===
  futureObligations = findObligations(
    contractId: originalContract.id,
    periodStart: >= effectiveFrom,
    status: IN ["scheduled", "pending_input", "pending_calculation"]
  )

  FOR EACH obligation IN futureObligations:
    obligation.status = "cancelled"
    obligation.skippedReason = "Contract amended: " + reason
    update(obligation)
  END FOR

  // === Step 3: Create New Version Draft ===
  newContract = clone(originalContract)
  newContract.id = generateUUID()
  newContract.version = originalContract.version + 1
  newContract.previousVersionId = originalContract.id
  newContract.status = "draft"
  newContract.effectiveFrom = effectiveFrom
  newContract.publishedAt = NULL
  newContract.signedAt = NULL
  insert(newContract)

  // === Step 4: Audit ===
  auditLog("contract_amended", originalContract.id, {
    amendmentType,
    effectiveFrom,
    reason,
    newVersionId: newContract.id,
    cancelledObligations: futureObligations.length
  })

  RETURN newContract
END FUNCTION
```

---

## 6. SCHEDULED → READY TRANSITION

### 6.1 Daily Obligation Readiness Check

```pseudo
// Runs daily at 00:15 UTC
FUNCTION checkObligationReadiness():

  billingPolicies = getAllActiveBillingPolicies()

  FOR EACH policy IN billingPolicies:
    today = currentDate(policy.airport.timezone)
    leadDays = policy.leadDays ?? 5  // Default: 5 days before due date

    // Find scheduled obligations approaching due date
    eligibleObligations = findObligations(
      airportId: policy.airportId,
      status: "scheduled",
      dueDate: <= addDays(today, leadDays)
    )

    FOR EACH obligation IN eligibleObligations:
      // Verify contract is still active
      contract = getContract(obligation.contractId)
      IF contract.status == "active":
        obligation.status = "ready"
        update(obligation)
      END IF
    END FOR
  END FOR
END FUNCTION
```

---

## 7. FILE UPLOAD (DECLARATION ATTACHMENTS)

### 7.1 Storage Strategy: Local + Docker Volume

```pseudo
// Storage config
FILE_STORAGE_PATH = "/app/uploads"  // Docker volume mounted
MAX_FILE_SIZE = 10 * 1024 * 1024    // 10 MB
ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".xlsx"]

FUNCTION uploadDeclarationAttachment(declarationId, file, fileType, uploadedBy):

  declaration = getDeclaration(declarationId)

  // Validation
  IF declaration.status NOT IN ["draft", "submitted"]:
    THROW ValidationError("Cannot upload to frozen/rejected declaration")
  END IF

  IF file.size > MAX_FILE_SIZE:
    THROW ValidationError("Dosya boyutu 10MB'ı aşamaz")
  END IF

  IF file.mimeType NOT IN ALLOWED_MIME_TYPES:
    THROW ValidationError("İzin verilen dosya tipleri: PDF, JPEG, PNG, XLSX")
  END IF

  // Generate safe filename
  extension = getExtension(file.originalName)
  safeName = `${declaration.tenantId}_${formatDate(declaration.periodStart)}_${fileType}_${generateShortUUID()}${extension}`

  // Create directory structure
  dirPath = `${FILE_STORAGE_PATH}/${declaration.airportId}/${declaration.tenantId}/${formatYearMonth(declaration.periodStart)}`
  ensureDirectory(dirPath)

  // Save file
  filePath = `${dirPath}/${safeName}`
  writeFile(filePath, file.buffer)

  // Create DB record
  attachment = {
    declarationId: declarationId,
    fileName: file.originalName,
    fileType: fileType,  // "pos_report" | "z_report" | "concessionaire_statement"
    fileUrl: filePath,   // Internal path (served via API, not direct URL)
    fileSizeBytes: file.size,
    uploadedBy: uploadedBy
  }
  insert(attachment)

  RETURN attachment
END FUNCTION

// Serving files via API (not direct filesystem access)
FUNCTION getAttachmentFile(attachmentId, requestingUserId):
  attachment = getAttachment(attachmentId)
  declaration = getDeclaration(attachment.declarationId)

  // Authorization check
  IF NOT canAccess(requestingUserId, declaration.tenantId):
    THROW ForbiddenError()
  END IF

  RETURN streamFile(attachment.fileUrl)
END FUNCTION
```

---

## 8. WEBHOOK PROCESSING

```pseudo
FUNCTION processStripeWebhook(request):

  // === Step 1: Verify Signature ===
  signature = request.headers["stripe-signature"]
  event = stripe.webhooks.constructEvent(request.rawBody, signature, WEBHOOK_SECRET)

  // === Step 2: Timestamp Check ===
  IF event.created < (now() - 5 minutes):
    logWarning("Stale webhook event", { eventId: event.id, age: now() - event.created })
    // Still process, but log warning
  END IF

  // === Step 3: Idempotency Check ===
  existingEvent = findWebhookEvent(stripeEventId: event.id)
  IF existingEvent AND existingEvent.processed:
    RETURN { status: 200, message: "Already processed" }
  END IF

  // === Step 4: Log Event ===
  webhookLog = {
    stripeEventId: event.id,
    eventType: event.type,
    payload: event.data,
    processed: false
  }
  INSERT webhookLog  // Insert before processing for crash recovery

  // === Step 5: Process Event ===
  TRY:
    SWITCH event.type:

      CASE "invoice.finalized":
        invoiceLog = findInvoiceLog(stripeInvoiceId: event.data.object.id)
        IF invoiceLog:
          invoiceLog.status = "finalized"
          invoiceLog.stripeHostedUrl = event.data.object.hosted_invoice_url
          invoiceLog.stripePdfUrl = event.data.object.invoice_pdf
          update(invoiceLog)

          // Notify tenant
          notify(invoiceLog.tenantId, "invoice_created", {
            invoiceUrl: invoiceLog.stripeHostedUrl
          })
        END IF

      CASE "invoice.paid":
        invoiceLog = findInvoiceLog(stripeInvoiceId: event.data.object.id)
        IF invoiceLog:
          invoiceLog.status = "paid"
          invoiceLog.paidAt = fromStripeTimestamp(event.data.object.status_transitions.paid_at)
          update(invoiceLog)

          // Update obligations → settled
          obligations = findObligations(invoiceLogId: invoiceLog.id)
          FOR EACH obligation IN obligations:
            obligation.status = "settled"
            obligation.settledAt = now()
            update(obligation)
          END FOR

          // Create/update settlement ledger
          updateSettlementLedger(invoiceLog)

          // Notify
          notify(invoiceLog.tenantId, "payment_received", { invoiceId: invoiceLog.id })
          notify("finance", "payment_received", { invoiceId: invoiceLog.id, amount: invoiceLog.amountTotal })
        END IF

      CASE "invoice.payment_failed":
        invoiceLog = findInvoiceLog(stripeInvoiceId: event.data.object.id)
        IF invoiceLog:
          notify(invoiceLog.tenantId, "payment_failed", { invoiceUrl: invoiceLog.stripeHostedUrl })
          notify("finance", "payment_failed", { invoiceId: invoiceLog.id, tenantId: invoiceLog.tenantId })
        END IF

      CASE "invoice.overdue":
        invoiceLog = findInvoiceLog(stripeInvoiceId: event.data.object.id)
        IF invoiceLog:
          invoiceLog.status = "past_due"
          update(invoiceLog)

          notify(invoiceLog.tenantId, "invoice_overdue", { invoiceUrl: invoiceLog.stripeHostedUrl })
          notify("finance", "invoice_overdue", { invoiceId: invoiceLog.id, tenantId: invoiceLog.tenantId })
        END IF

      CASE "invoice.voided":
        invoiceLog = findInvoiceLog(stripeInvoiceId: event.data.object.id)
        IF invoiceLog:
          invoiceLog.status = "voided"
          invoiceLog.voidedAt = now()
          update(invoiceLog)

          // Revert obligations to ready
          obligations = findObligations(invoiceLogId: invoiceLog.id)
          FOR EACH obligation IN obligations:
            obligation.status = "ready"
            obligation.invoiceLogId = NULL
            obligation.invoicedAt = NULL
            update(obligation)
          END FOR
        END IF
    END SWITCH

    // === Step 6: Mark Processed ===
    webhookLog.processed = true
    webhookLog.processedAt = now()
    update(webhookLog)

  CATCH error:
    webhookLog.errorMessage = error.message
    webhookLog.retryCount++
    update(webhookLog)
    THROW error  // Return 500 → Stripe retries
  END TRY

  RETURN { status: 200 }
END FUNCTION
```

---

## 9. HELPER FUNCTIONS REFERENCE

```pseudo
// Date helpers
startOfMonth(date) → first day of month at 00:00
endOfMonth(date) → last day of month at 23:59
startOfNextMonth(date) → first day of next month
daysInMonth(date) → 28-31
daysBetween(start, end) → integer (exclusive of end day)
isLeapYear(date) → boolean
isWeekend(date) → boolean (Saturday or Sunday)
addDays(date, n) → date + n days
addMonths(date, n) → date + n months
setDay(date, day) → same month/year with given day (clamped to month end)

// Currency helpers
toStripeCents(amount: Decimal) → integer (amount * 100, rounded)
fromStripeCents(cents: integer) → Decimal (cents / 100)
roundHalfUp(value, decimals) → rounded decimal

// Security helpers
sha256(input: string) → hex string
generateUUID() → UUID v4
generateShortUUID() → 8 char hex
generateToken() → 32 char random hex

// Mapping helpers
mapServiceTypeToChargeType(serviceType):
  "rent" → "base_rent"
  "revenue_share" → "revenue_share"
  "service_charge" → "service_charge"
  "utility" → "utility"
```

---

## 10. TEST SCENARIOS

### Obligation Generation

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Contract 1 Jan → 31 Dec, monthly rent, 300m², 150 TRY/m² | 12 obligations, each 45,000 TRY, status: scheduled |
| 2 | Contract 15 Mar → 31 Dec, monthly rent | First obligation: 15-31 Mar prorated (17/31 * amount), then 9 full months |
| 3 | Contract with MAG 1,200,000 TRY | 12 rent + 12 revenue_share (pending_input) + 1 MAG true-up (pending_calculation) = 25 obligations |
| 4 | Contract 1 Jan → 30 Jun (6 months) | 6 rent + 6 rev share + 1 MAG true-up. MAG true-up prorated (6/12) |
| 5 | Duplicate line_hash | DuplicateObligationError thrown, no DB insert |

### MAG Settlement

| # | Scenario | Expected |
|---|----------|----------|
| 1 | MAG/12 = 100K, rev share = 130K | Billed: 130K. Shortfall: 0. Surplus: 30K (not carried) |
| 2 | MAG/12 = 100K, rev share = 70K | Billed: 100K. Shortfall: 30K obligation created |
| 3 | MAG/12 = 100K, no declaration | Obligation stays pending_input → skipped |
| 4 | Year-end: YTD rev = 1,000K, MAG = 1,200K | True-up: 200K obligation |
| 5 | Year-end: YTD rev = 1,500K, MAG = 1,200K | No true-up. True-up obligation cancelled |
| 6 | Contract starts Jul, MAG = 1,200K | Prorated MAG = 600K (6/12). Year-end comparison against 600K |

### Billing Run

| # | Scenario | Expected |
|---|----------|----------|
| 1 | 5 tenants, 10 rent obligations (all ready) | 5 invoices (1 per tenant, charge_type: base_rent) |
| 2 | 1 tenant, rent + rev share (both ready) | 2 invoices (separate per charge_type) |
| 3 | Delta run after completed run | Only new obligations since previous run |
| 4 | Full run after cancelled run | All eligible obligations from scratch |
| 5 | Partial cancel: 2 of 5 tenants | 2 tenants' invoices voided, obligations back to ready. 3 tenants unaffected |
