import { apiClient } from './client';

export interface ServiceDefinition {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  billingFrequency?: string;
  formulaId?: string;
  formula?: { id: string; name: string };
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function getServices(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<PaginatedResponse<ServiceDefinition>>('/services', { params });
  return data;
}

export async function getService(id: string) {
  const { data } = await apiClient.get<ServiceDefinition>(`/services/${id}`);
  return data;
}

export async function createService(dto: Partial<ServiceDefinition>) {
  const { data } = await apiClient.post<ServiceDefinition>('/services', dto);
  return data;
}

export async function updateService(id: string, dto: Partial<ServiceDefinition>) {
  const { data } = await apiClient.patch<ServiceDefinition>(`/services/${id}`, dto);
  return data;
}

export async function publishService(id: string) {
  const { data } = await apiClient.post<ServiceDefinition>(`/services/${id}/publish`);
  return data;
}

export async function newServiceVersion(id: string) {
  const { data } = await apiClient.post<ServiceDefinition>(`/services/${id}/new-version`);
  return data;
}

export async function deprecateService(id: string) {
  const { data } = await apiClient.post<ServiceDefinition>(`/services/${id}/deprecate`);
  return data;
}
