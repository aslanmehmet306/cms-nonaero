import { apiClient } from './client';

export interface DashboardData {
  totalRevenue: number;
  outstandingInvoices: number;
  collectionRate: number;
  activeTenants: number;
  activeContracts: number;
  pendingObligations: number;
}

export interface DashboardParams {
  airportId?: string;
  currency?: string;
}

export interface RevenueSummaryItem {
  key: string;
  label: string;
  amount: number;
  currency: string;
}

export interface RevenueSummaryData {
  items: RevenueSummaryItem[];
  total: number;
  warning?: string;
}

export interface RevenueSummaryParams {
  airportId?: string;
  periodStart?: string;
  periodEnd?: string;
  groupBy?: 'tenant' | 'service_type';
  currency?: string;
}

export interface AgingReportData {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90plus: number;
  total: number;
}

export interface AgingReportParams {
  airportId?: string;
  asOfDate?: string;
  currency?: string;
}

export interface ObligationReportParams {
  airportId?: string;
  tenantId?: string;
  status?: string;
  periodStart?: string;
  periodEnd?: string;
  page?: number;
  limit?: number;
}

export interface BillingHistoryParams {
  airportId?: string;
  page?: number;
  limit?: number;
}

export async function getDashboard(
  params?: DashboardParams,
): Promise<DashboardData> {
  const { data } = await apiClient.get<DashboardData>('/reports/dashboard', {
    params,
  });
  return data;
}

export async function getRevenueSummary(
  params?: RevenueSummaryParams,
): Promise<RevenueSummaryData> {
  const { data } = await apiClient.get<RevenueSummaryData>(
    '/reports/revenue-summary',
    { params },
  );
  return data;
}

export async function getAgingReport(
  params?: AgingReportParams,
): Promise<AgingReportData> {
  const { data } = await apiClient.get<AgingReportData>('/reports/aging', {
    params,
  });
  return data;
}

export async function getObligations(
  params?: ObligationReportParams,
): Promise<unknown> {
  const { data } = await apiClient.get('/reports/obligations', { params });
  return data;
}

export async function getBillingHistory(
  params?: BillingHistoryParams,
): Promise<unknown> {
  const { data } = await apiClient.get('/reports/billing-history', { params });
  return data;
}
