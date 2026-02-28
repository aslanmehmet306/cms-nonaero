# Feature Landscape

**Domain:** Airport Non-Aeronautical Revenue Management SaaS
**Researched:** 2026-02-28
**Confidence:** MEDIUM (based on domain knowledge and project context; web search unavailable for market validation)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature                            | Why Expected                                                                     | Complexity | Notes                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| **Contract Management**            | Core workflow - every airport manages commercial leases                          | Medium     | Draft → Active → Amendment → Termination lifecycle                       |
| **Tenant/Concessionaire Database** | Foundation for all billing and relationships                                     | Low        | Basic CRUD with contact info, multiple contracts per tenant              |
| **Area/Space Hierarchy**           | Airports structure spaces (Terminal → Floor → Zone → Unit) for assignment        | Medium     | Tree structure with metadata (size, type, status)                        |
| **MAG (Minimum Annual Guarantee)** | Standard concession contract structure globally                                  | High       | Monthly settlement (higher-of), year-end true-up, complex edge cases     |
| **Revenue Share Calculation**      | Core billing model for concessionaires                                           | Medium     | Percentage-based on declared revenue, tiered structures common           |
| **Revenue Declaration Ingestion**  | Tenants must report sales for revenue share                                      | Medium     | CSV/Excel upload, validation, historical tracking                        |
| **Fixed Rent Billing**             | Basic lease revenue for non-retail tenants                                       | Low        | Periodic fixed amount, proration on contract start                       |
| **Utility Billing**                | Airports pass through utility costs (electricity, water, gas, heating, cleaning) | High       | Meter reading, consumption calculation, rate tables, allocation methods  |
| **Invoice Generation**             | Must produce invoices for payment collection                                     | Medium     | PDF/email delivery, line-item breakdown, payment terms                   |
| **Multi-Currency Support**         | International airports operate in multiple currencies                            | Medium     | Currency per contract, exchange rate management, reporting consolidation |
| **Audit Trail**                    | Compliance requirement - billing must be traceable to contract                   | Medium     | Obligation → Formula → Contract linkage, immutable history               |
| **Payment Tracking**               | Track invoice status (sent, paid, overdue)                                       | Low        | Status updates, payment date recording                                   |
| **Reporting Dashboard**            | Finance teams need visibility into revenue, aging, collections                   | Medium     | Revenue by category, tenant, period; aging reports; KPIs                 |
| **Contract Document Storage**      | Legal requirement to maintain signed agreements                                  | Low        | File upload/download, version history                                    |
| **Basic User Access Control**      | Multiple users need role-based permissions                                       | Medium     | Admin, Finance, Operations roles at minimum                              |
| **Obligation Scheduling**          | Contracts generate recurring billing obligations                                 | High       | Auto-generation from contract terms, date logic, proration               |
| **Service Charge Management**      | Airports charge for common area maintenance, marketing funds                     | Medium     | Allocation formulas (per sqm, fixed amount, revenue-based)               |
| **Proration Logic**                | Mid-period contract start/end must calculate partial charges                     | High       | Complex date arithmetic, varies by charge type                           |
| **Historical Rate Preservation**   | Billing must use rate in effect at obligation date                               | Medium     | Rate versioning, effective dating                                        |
| **Index-Based Escalation**         | Rent adjusts annually by CPI or similar index                                    | Medium     | Index rate tracking, automatic recalculation                             |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature                             | Value Proposition                                           | Complexity | Notes                                                          |
| ----------------------------------- | ----------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| **Formula Engine**                  | Define ANY pricing structure without code changes           | High       | Sandbox execution (math.js), custom variables, version control |
| **Real-Time Billing Preview**       | See calculated charges before committing billing run        | Medium     | Dry-run mode, delta calculation for re-runs                    |
| **Async Billing Orchestration**     | Handle large billing runs without timeouts                  | High       | Queue-based (BullMQ), progress tracking, cancellation          |
| **Contract Amendment Tracking**     | Full amendment history with effective dating                | High       | Snapshot preservation, point-in-time reconstruction            |
| **Automated Email Notifications**   | Proactive communication reduces support burden              | Low        | Cut-off reminders, invoice delivery, payment confirmations     |
| **Tenant Self-Service Portal**      | Tenants submit revenue declarations, view invoices online   | High       | Separate auth, limited data access, reduces manual data entry  |
| **CSV/Excel Bulk Import**           | Onboard existing contracts from legacy systems              | Medium     | Template-based, validation, error handling                     |
| **Reconciliation Tools**            | Compare expected vs actual revenue, identify discrepancies  | High       | Variance analysis, drill-down to source transactions           |
| **Budget vs Actual Reporting**      | Finance teams forecast and compare to actuals               | Medium     | Budget input interface, variance reporting                     |
| **API for Integrations**            | Connect to ERP, accounting systems, payment gateways        | High       | RESTful design, authentication, webhooks                       |
| **White-Label Configuration**       | Airports brand the system as their own                      | Low        | Logo, color scheme, email templates                            |
| **Mobile-Optimized UI**             | Operations staff use tablets for meter readings             | Medium     | Responsive design, offline-capable meter entry                 |
| **Configurable Approval Workflows** | Require approvals for contract changes, billing adjustments | High       | Multi-step workflows, notification chains                      |
| **Smart Duplicate Detection**       | Prevent double-billing from repeated operations             | Medium     | Hash-based line item deduplication                             |
| **Compliance Reporting**            | Pre-built reports for regulatory requirements               | Medium     | Varies by jurisdiction (IFRS 15/16, local tax laws)            |
| **Batch Invoice Generation**        | Generate all invoices for a period in one operation         | Medium     | Performance optimization, error handling                       |
| **Grace Period Management**         | Automate late fees, suspension logic                        | Medium     | Configurable rules, automatic triggers                         |
| **Revenue Forecasting**             | Predict future revenue based on historical patterns         | High       | Statistical modeling, seasonality adjustment                   |
| **Meter Reading Mobile App**        | Dedicated app for field meter readings                      | High       | Native iOS/Android, offline sync, photo capture                |
| **Dynamic Dashboard Builder**       | Users create custom reports without developer               | High       | Drag-drop interface, saved views                               |
| **E-Invoice Integration**           | Generate tax-compliant electronic invoices                  | High       | Country-specific (e.g., Turkey GIB, EU Peppol)                 |
| **Allocation Engine**               | Split shared costs across multiple tenants                  | High       | Configurable allocation bases, adjustment workflows            |
| **Credit Note/Adjustment Workflow** | Handle billing errors, refunds, write-offs                  | High       | Reversal logic, approval requirements, audit trail             |
| **Equipment/Asset Tracking**        | Track airport-owned equipment leased to tenants             | Medium     | Asset registry, depreciation, maintenance schedules            |
| **SLA Monitoring**                  | Track service delivery against contractual SLAs             | Medium     | KPI tracking, breach alerts, penalty calculations              |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature                        | Why Avoid                                                        | What to Do Instead                                                                      |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Built-in Payment Processing**     | Payment gateways (Stripe, local providers) do this better        | Integrate with Stripe/payment gateway via adapter pattern                               |
| **Aeronautical Revenue Management** | Completely different domain (landing fees, parking, handling)    | Stay focused on non-aero; refer aero customers to specialized tools                     |
| **General Purpose CRM**             | Salesforce/HubSpot exist; airport tenant relationships are niche | Basic tenant contact management only; integrate with external CRM if needed             |
| **Project Management Tools**        | Not core to billing workflow                                     | Link to external tools (Jira, Asana) if project tracking needed for tenant improvements |
| **Document Collaboration**          | Google Docs/Office 365 do this well                              | Store final signed contracts only; collaborate externally                               |
| **Chat/Messaging**                  | Out of scope for billing system                                  | Use email notifications; integrate Slack/Teams if needed                                |
| **Inventory Management**            | Airport retail tenants use POS systems for this                  | Accept revenue totals only; don't track inventory                                       |
| **HR/Payroll**                      | Unrelated to tenant billing                                      | Never build; airports use separate systems                                              |
| **Custom Reporting Builder (v1)**   | High complexity, low v1 value                                    | Provide fixed reports in v1, add builder in v2 if validated                             |
| **Multi-Tenant Architecture (v1)**  | Premature optimization for solo dev                              | Single-airport demo first; refactor for multi-tenant after validation                   |
| **Blockchain/Web3 Features**        | No proven value in this domain                                   | Avoid unless specific customer demands it                                               |
| **AI/ML "Smart" Features (v1)**     | Accuracy > automation for v1 trust                               | Manual processes validated first; automate after patterns proven                        |
| **Native Mobile App (v1)**          | Web-first is faster to market                                    | Responsive web; native app only if validated need                                       |
| **Real-Time Collaboration**         | Single-user workflows dominate                                   | Sequential editing with optimistic locking; avoid operational transform complexity      |
| **Custom Workflow Builder**         | Over-engineering for v1                                          | Hard-code approval rules; make configurable after validation                            |

## Feature Dependencies

```
Contract Management → Obligation Scheduling → Invoice Generation
    ↓
Area Hierarchy → Contract Assignment → Billing
    ↓
Tenant Database → Contract Management → Payment Tracking
    ↓
Service Definition → Formula Engine → Obligation Calculation
    ↓
Revenue Declaration Ingestion → Revenue Share Calculation → MAG Settlement
    ↓
Utility Meter Reading → Consumption Calculation → Utility Billing
    ↓
Audit Trail ← ALL billing operations
    ↓
Multi-Currency → Invoice Generation → Payment Tracking
    ↓
User Access Control → ALL admin operations
    ↓
Email Notifications ← Invoice Generation, Payment Tracking
```

**Critical Path for MVP:**

1. Area Hierarchy + Tenant Database (foundation)
2. Service Definition + Formula Engine (pricing logic)
3. Contract Management (legal basis)
4. Obligation Scheduling (automation)
5. Billing Run Orchestration (execution)
6. Invoice Generation (output)
7. Dashboard (visibility)

**Deferred Dependencies:**

- Tenant Portal depends on: User auth, role-based access, invoice API
- E-Invoice depends on: Invoice generation, country-specific compliance research
- Allocation Engine depends on: Service charge management, formula engine
- Credit Note depends on: Invoice generation, approval workflows

## MVP Recommendation

**Prioritize (Table Stakes for Demo):**

1. **Area Hierarchy Management** - Show realistic airport structure (Terminal 1 → Retail Floor → Zone A → Shop 12)
2. **Tenant Database** - 5-10 realistic concessionaires (duty-free, F&B, lounge, parking, advertising)
3. **Service Definition** - 5 service types: Fixed Rent, Revenue Share, MAG, Utility (Electric), Service Charge
4. **Formula Engine** - Prove flexibility: `revenue * share_rate`, `max(mag_amount, revenue * share_rate)`, `consumption * unit_rate`
5. **Contract Management** - Full lifecycle: draft → publish → active, show amendment
6. **Obligation Scheduling** - Automated monthly schedule generation, show proration
7. **Revenue Declaration Ingestion** - CSV upload for duty-free tenant
8. **MAG Settlement** - Monthly higher-of calculation, year-end true-up visible
9. **Utility Billing** - Single meter reading → consumption → invoice
10. **Billing Run Orchestration** - Execute full billing period, show progress
11. **Invoice Generation** - PDF invoice via Stripe, show line items
12. **Multi-Currency** - 1 tenant in EUR, rest in TRY (show exchange rate handling)
13. **Audit Trail** - Click invoice line → see formula → see contract clause
14. **Dashboard** - Revenue by tenant, by service type, aging report, KPIs
15. **Email Notifications** - Demo email for invoice delivery

**Defer to v2 (Post-Validation):**

- Tenant self-service portal
- E-invoice integration (GIB/e-Fatura)
- Equipment/asset tracking
- Allocation engine
- Credit note workflow
- Mobile meter reading app
- Budget vs actual reporting
- Approval workflows
- Real-time CPI/TuIK API
- Reconciliation tools
- Grace period/late fee automation

**Never Build:**

- Payment processing (use Stripe)
- CRM features (basic contact info only)
- Document collaboration
- Inventory management
- HR/payroll
- Blockchain
- Native mobile app (v1)

## Rationale

**Why This Order:**

1. **Data foundation first** - Can't have contracts without tenants and spaces
2. **Pricing logic second** - Formula engine proves differentiation early
3. **Workflow third** - Contract → Obligation → Invoice shows automation
4. **Billing execution fourth** - Orchestration + invoice generation = demo climax
5. **Visibility last** - Dashboard makes demo impressive but isn't prerequisite

**Complexity vs Value Trade-offs:**

- **High complexity, high value:** Formula engine, MAG settlement, billing orchestration (MUST HAVE)
- **High complexity, medium value:** Allocation engine, credit notes, approval workflows (DEFER)
- **Medium complexity, high value:** Obligation scheduling, multi-currency, audit trail (MVP)
- **Low complexity, high value:** Dashboard, email notifications, tenant database (MVP)

**Table Stakes Threshold:**
If we skip any "table stakes" feature, the demo won't feel like a real product. For example:

- No MAG → "This doesn't work for duty-free concessions" (deal-breaker)
- No multi-currency → "We have international tenants" (limits market)
- No audit trail → "How do I verify this invoice?" (trust issue)
- No dashboard → "I can't see my revenue" (usability failure)

**Differentiator Strategy:**

- **Formula engine** - Main differentiator vs Excel hell
- **Async billing** - Shows scalability vs desktop software
- **Amendment tracking** - Shows maturity vs basic systems
- **Audit trail** - Shows compliance vs manual processes

These four differentiate without over-engineering. Other differentiators (tenant portal, e-invoice, allocation engine) can wait for v2.

## Sources

**Confidence Assessment:**

- **Table Stakes:** MEDIUM confidence - based on domain expertise (15+ years per PROJECT.md) and common airport revenue management practices, but not validated against current market offerings due to unavailable web search
- **Differentiators:** MEDIUM confidence - based on competitive analysis patterns and legacy system limitations mentioned in PROJECT.md
- **Anti-Features:** HIGH confidence - based on clear project constraints (solo developer, demo-ready v1, specific tech stack)
- **Feature Dependencies:** HIGH confidence - based on logical workflow requirements and data model relationships
- **MVP Recommendation:** HIGH confidence - based on PROJECT.md requirements and demo-readiness goal

**Validation Needed:**

- Current commercial airport revenue management software features (e.g., IBS, Inform, Veovo, ADB Safegate commercial modules)
- Emerging SaaS competitors in this space (if any)
- Recent industry trends (2025-2026) in airport commercial management
- Specific feature expectations by airport size (small regional vs large hub)

**Methodology Note:**
Web search tools were unavailable during research. Findings are based on:

1. Domain expertise context from PROJECT.md (15+ years in field)
2. General knowledge of enterprise billing systems
3. Common patterns in commercial lease management
4. Logical feature dependencies from workflow analysis

Recommend validating table stakes and differentiators against:

- IBS (airport commercial management suite)
- Inform (airport revenue management)
- Current RFP requirements from target airports
- Airport finance director interviews

---

_Research completed 2026-02-28. Web search unavailable; findings based on domain knowledge and project context. Validate against current market before finalizing roadmap._
