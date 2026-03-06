// All enums matching Prisma schema exactly (48 enums)
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
  onboarding = 'onboarding',
}

export enum TenantClassification {
  anchor = 'anchor',
  standard = 'standard',
  startup = 'startup',
  temporary = 'temporary',
  franchise = 'franchise',
}

export enum LegalEntityType {
  corporation = 'corporation',
  limited_company = 'limited_company',
  sole_proprietor = 'sole_proprietor',
  partnership = 'partnership',
  cooperative = 'cooperative',
  branch_office = 'branch_office',
}

export enum OnboardingStatus {
  pending_documents = 'pending_documents',
  documents_received = 'documents_received',
  under_review = 'under_review',
  approved = 'approved',
  completed = 'completed',
}

export enum RiskCategory {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export enum AreaType {
  terminal = 'terminal',
  floor = 'floor',
  zone = 'zone',
  unit = 'unit',
}

export enum AreaCategory {
  commercial = 'commercial',
  operational = 'operational',
  common = 'common',
  technical = 'technical',
}

export enum AreaUsageType {
  retail = 'retail',
  food_and_beverage = 'food_and_beverage',
  duty_free = 'duty_free',
  lounge = 'lounge',
  advertising = 'advertising',
  office = 'office',
  storage = 'storage',
  parking = 'parking',
  car_rental = 'car_rental',
  bank_atm = 'bank_atm',
  other = 'other',
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
  equipment_rental = 'equipment_rental',
  allocation_charge = 'allocation_charge',
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
  metered = 'metered',
  allocation = 'allocation',
}

export enum FormulaStatus {
  draft = 'draft',
  published = 'published',
  archived = 'archived',
}

// === Equipment & Asset Engine ===

export enum EquipmentType {
  pos_terminal = 'pos_terminal',
  digital_signage = 'digital_signage',
  kiosk = 'kiosk',
  utility_meter = 'utility_meter',
  hvac_unit = 'hvac_unit',
  security_camera = 'security_camera',
  wifi_access_point = 'wifi_access_point',
  vending_machine = 'vending_machine',
  furniture_set = 'furniture_set',
  kitchen_equipment = 'kitchen_equipment',
  other = 'other',
}

export enum EquipmentCategory {
  it_infrastructure = 'it_infrastructure',
  commercial_fixture = 'commercial_fixture',
  utility_infrastructure = 'utility_infrastructure',
  security = 'security',
  furniture = 'furniture',
  kitchen = 'kitchen',
  signage = 'signage',
  other_category = 'other_category',
}

export enum EquipmentStatus {
  registered = 'registered',
  in_storage = 'in_storage',
  commissioned = 'commissioned',
  under_maintenance = 'under_maintenance',
  decommissioned = 'decommissioned',
  disposed = 'disposed',
}

export enum EquipmentOwnership {
  airport = 'airport',
  tenant_owned = 'tenant_owned',
  third_party = 'third_party',
}

export enum DepreciationMethod {
  straight_line = 'straight_line',
  declining_balance = 'declining_balance',
  no_depreciation = 'no_depreciation',
}

export enum MeterReadingType {
  periodic = 'periodic',
  opening = 'opening',
  closing = 'closing',
  audit = 'audit',
}

export enum MeterReadingSource {
  manual = 'manual',
  iot = 'iot',
  tenant_declared = 'tenant_declared',
}

export enum MaintenanceType {
  preventive = 'preventive',
  corrective = 'corrective',
  inspection = 'inspection',
  calibration = 'calibration',
}

// === Area Occupancy & Allocation ===

export enum OccupancyType {
  exclusive = 'exclusive',
  shared = 'shared',
  temporary = 'temporary',
  storage_use = 'storage_use',
}

export enum OccupancyStatus {
  planned = 'planned',
  occupied = 'occupied',
  vacated = 'vacated',
  under_renovation = 'under_renovation',
}

export enum AllocationMethod {
  proportional_m2 = 'proportional_m2',
  equal_split = 'equal_split',
  revenue_weighted = 'revenue_weighted',
  fixed_amount = 'fixed_amount',
  passenger_weighted = 'passenger_weighted',
}

export enum AllocationStatus {
  draft = 'draft',
  approved_alloc = 'approved_alloc',
  active_alloc = 'active_alloc',
  archived_alloc = 'archived_alloc',
}

// === Contract ===

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

export enum ContractType {
  standard = 'standard',
  concession = 'concession',
  license = 'license',
  management = 'management',
  temporary = 'temporary',
}

export enum PerformanceMetric {
  revenue = 'revenue',
  pax_spend = 'pax_spend',
  sales_per_m2 = 'sales_per_m2',
  footfall = 'footfall',
}

export enum RenewalOption {
  no_renewal = 'no_renewal',
  auto_renew = 'auto_renew',
  option_to_renew = 'option_to_renew',
  mutual_agreement = 'mutual_agreement',
}

export enum GuaranteeType {
  none = 'none',
  deposit = 'deposit',
  bank_letter = 'bank_letter',
  corporate_guarantee = 'corporate_guarantee',
}

// === Credit Note ===

export enum CreditNoteReason {
  billing_error = 'billing_error',
  service_interruption = 'service_interruption',
  area_unavailability = 'area_unavailability',
  equipment_downtime = 'equipment_downtime',
  goodwill = 'goodwill',
  contract_amendment = 'contract_amendment',
  dispute_resolution = 'dispute_resolution',
  other_reason = 'other_reason',
}

export enum CreditNoteStatus {
  draft = 'draft',
  pending_approval = 'pending_approval',
  approved_cn = 'approved_cn',
  issued = 'issued',
  voided = 'voided',
}

// === Obligation ===

export enum ObligationType {
  rent = 'rent',
  revenue_share = 'revenue_share',
  mag_shortfall = 'mag_shortfall',
  mag_true_up = 'mag_true_up',
  equipment = 'equipment',
  allocation = 'allocation',
}

export enum ChargeType {
  base_rent = 'base_rent',
  revenue_share = 'revenue_share',
  service_charge = 'service_charge',
  utility = 'utility',
  mag_settlement = 'mag_settlement',
  equipment_rental = 'equipment_rental',
  allocation_charge = 'allocation_charge',
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

// === Declaration ===

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

// === Billing Run ===

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

// === Invoice ===

export enum InvoiceStatus {
  created = 'created',
  finalized = 'finalized',
  sent = 'sent',
  paid = 'paid',
  past_due = 'past_due',
  voided = 'voided',
  uncollectible = 'uncollectible',
}

// === Settlement ===

export enum SettlementType {
  monthly_mag = 'monthly_mag',
  year_end_true_up = 'year_end_true_up',
}

// === Policy ===

export enum PolicyStatus {
  draft = 'draft',
  approved = 'approved',
  active = 'active',
  archived = 'archived',
}

// === Notification ===

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
  equipment_maintenance_due = 'equipment_maintenance_due',
  tenant_risk_category_changed = 'tenant_risk_category_changed',
  insurance_expiring = 'insurance_expiring',
  credit_note_issued = 'credit_note_issued',
}

export enum NotificationChannel {
  email = 'email',
  in_app = 'in_app',
  both = 'both',
}
