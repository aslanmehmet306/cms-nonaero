import { apiClient } from './client';

export interface BillingRun {
  id: string;
  airportId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  mode: string;
  type?: string;
  totalObligations?: number;
  processedObligations?: number;
  filters?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateBillingRunDto {
  airportId: string;
  periodStart: string;
  periodEnd: string;
  tenantIds?: string[];
  mode?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function getBillingRuns(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<PaginatedResponse<BillingRun>>('/billing-runs', { params });
  return data;
}

export async function getBillingRun(id: string) {
  const { data } = await apiClient.get<BillingRun>(`/billing-runs/${id}`);
  return data;
}

export async function createBillingRun(dto: CreateBillingRunDto) {
  const { data } = await apiClient.post<BillingRun>('/billing-runs', dto);
  return data;
}

export async function approveBillingRun(id: string) {
  const { data } = await apiClient.patch<BillingRun>(`/billing-runs/${id}/approve`);
  return data;
}

export async function rejectBillingRun(id: string) {
  const { data } = await apiClient.patch<BillingRun>(`/billing-runs/${id}/reject`);
  return data;
}

export async function cancelBillingRun(id: string) {
  const { data } = await apiClient.patch<BillingRun>(`/billing-runs/${id}/cancel`);
  return data;
}

export async function cancelBillingRunTenants(id: string, tenantIds: string[]) {
  const { data } = await apiClient.patch<BillingRun>(`/billing-runs/${id}/cancel-tenants`, { tenantIds });
  return data;
}

export async function rerunBillingRun(id: string) {
  const { data } = await apiClient.post<BillingRun>(`/billing-runs/${id}/rerun`);
  return data;
}
