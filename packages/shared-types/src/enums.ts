// All enums matching Prisma schema exactly (25 enums)
// Keep in sync with apps/api/prisma/schema.prisma

export enum UserRole {
  super_admin = 'super_admin',
  airport_admin = 'airport_admin',
  commercial_manager = 'commercial_manager',
  finance = 'finance',
  auditor = 'auditor',
  tenant_admin = 'tenant_admin',
  tenant_user = 'tenant_user',
}

export enum TenantStatus {
  active = 'active',
  suspended = 'suspended',
  deactivated = 'deactivated',
}

export enum AreaType {
  terminal = 'terminal',
  floor = 'floor',
  zone = 'zone',
  unit = 'unit',
}

export enum UnitClassification {
  commercial = 'commercial',
  food_beverage = 'food_beverage',
  bank = 'bank',
  rent_a_car = 'rent_a_car',
  office = 'office',
  storage = 'storage',
  lounge = 'lounge',
  duty_free = 'duty_free',
  other = 'other',
}

export enum MeterType {
  electricity = 'electricity',
  water = 'water',
  gas = 'gas',
  heating = 'heating',
}

export enum ServiceType {
  rent = 'rent',
  revenue_share = 'revenue_share',
  service_charge = 'service_charge',
  utility = 'utility',
}

export enum ServiceStatus {
  draft = 'draft',
  published = 'published',
  deprecated = 'deprecated',
}

export enum BillingFrequency {
  monthly = 'monthly',
  quarterly = 'quarterly',
  annually = 'annually',
}

export enum FormulaType {
  arithmetic = 'arithmetic',
  conditional = 'conditional',
  step_band = 'step_band',
  revenue_share = 'revenue_share',
  escalation = 'escalation',
  proration = 'proration',
}

export enum FormulaStatus {
  draft = 'draft',
  published = 'published',
  archived = 'archived',
}

export enum ContractStatus {
  draft = 'draft',
  in_review = 'in_review',
  published = 'published',
  active = 'active',
  pending_amendment = 'pending_amendment',
  amended = 'amended',
  suspended = 'suspended',
  terminated = 'terminated',
}

export enum GuaranteeType {
  none = 'none',
  deposit = 'deposit',
  bank_letter = 'bank_letter',
  corporate_guarantee = 'corporate_guarantee',
}

export enum ObligationType {
  rent = 'rent',
  revenue_share = 'revenue_share',
  mag_shortfall = 'mag_shortfall',
  mag_true_up = 'mag_true_up',
}

export enum ChargeType {
  base_rent = 'base_rent',
  revenue_share = 'revenue_share',
  service_charge = 'service_charge',
  utility = 'utility',
  mag_settlement = 'mag_settlement',
}

export enum ObligationStatus {
  scheduled = 'scheduled',
  pending_input = 'pending_input',
  pending_calculation = 'pending_calculation',
  ready = 'ready',
  invoiced = 'invoiced',
  settled = 'settled',
  skipped = 'skipped',
  on_hold = 'on_hold',
  cancelled = 'cancelled',
}

export enum InvoiceProvider {
  stripe = 'stripe',
  erp = 'erp',
  mock = 'mock',
}

export enum DisputeStatus {
  none = 'none',
  disputed = 'disputed',
  resolved = 'resolved',
}

export enum DeclarationType {
  revenue = 'revenue',
  meter_reading = 'meter_reading',
}

export enum DeclarationStatus {
  draft = 'draft',
  submitted = 'submitted',
  validated = 'validated',
  rejected = 'rejected',
  frozen = 'frozen',
}

export enum BillingRunType {
  scheduled = 'scheduled',
  manual = 'manual',
  selective = 'selective',
  settlement = 'settlement',
}

export enum BillingRunMode {
  full = 'full',
  delta = 'delta',
}

export enum BillingRunStatus {
  initiated = 'initiated',
  scoping = 'scoping',
  calculating = 'calculating',
  draft_ready = 'draft_ready',
  approved = 'approved',
  rejected = 'rejected',
  invoicing = 'invoicing',
  completed = 'completed',
  partial = 'partial',
  cancelled = 'cancelled',
}

export enum InvoiceStatus {
  created = 'created',
  finalized = 'finalized',
  sent = 'sent',
  paid = 'paid',
  past_due = 'past_due',
  voided = 'voided',
  uncollectible = 'uncollectible',
}

export enum SettlementType {
  monthly_mag = 'monthly_mag',
  year_end_true_up = 'year_end_true_up',
}

export enum PolicyStatus {
  draft = 'draft',
  approved = 'approved',
  active = 'active',
  archived = 'archived',
}

export enum NotificationType {
  cutoff_approaching = 'cutoff_approaching',
  declaration_missing = 'declaration_missing',
  invoice_created = 'invoice_created',
  payment_received = 'payment_received',
  payment_failed = 'payment_failed',
  invoice_overdue = 'invoice_overdue',
  billing_run_completed = 'billing_run_completed',
  contract_expiring = 'contract_expiring',
  mag_shortfall = 'mag_shortfall',
}

export enum NotificationChannel {
  email = 'email',
  in_app = 'in_app',
  both = 'both',
}
