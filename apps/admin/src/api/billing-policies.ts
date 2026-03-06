import { apiClient } from './client';

export interface BillingPolicy {
  id: string;
  airportId: string;
  name: string;
  cutoffDay: number;
  issueDay: number;
  dueDateDays: number;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPolicyListResponse {
  data: BillingPolicy[];
}

export interface BillingPolicyListParams {
  airportId?: string;
}

export interface CreateBillingPolicyData {
  airportId: string;
  name: string;
  cutoffDay: number;
  issueDay: number;
  dueDateDays: number;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
}

export interface UpdateBillingPolicyData {
  name?: string;
  cutoffDay?: number;
  issueDay?: number;
  dueDateDays?: number;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
}

export async function getBillingPolicies(
  params?: BillingPolicyListParams,
): Promise<BillingPolicy[]> {
  const { data } = await apiClient.get<BillingPolicy[]>('/billing-policies', {
    params,
  });
  return data;
}

export async function getBillingPolicy(id: string): Promise<BillingPolicy> {
  const { data } = await apiClient.get<BillingPolicy>(
    `/billing-policies/${id}`,
  );
  return data;
}

export async function createBillingPolicy(
  payload: CreateBillingPolicyData,
): Promise<BillingPolicy> {
  const { data } = await apiClient.post<BillingPolicy>(
    '/billing-policies',
    payload,
  );
  return data;
}

export async function updateBillingPolicy(
  id: string,
  payload: UpdateBillingPolicyData,
): Promise<BillingPolicy> {
  const { data } = await apiClient.patch<BillingPolicy>(
    `/billing-policies/${id}`,
    payload,
  );
  return data;
}

export async function activateBillingPolicy(
  id: string,
): Promise<BillingPolicy> {
  const { data } = await apiClient.post<BillingPolicy>(
    `/billing-policies/${id}/activate`,
  );
  return data;
}
