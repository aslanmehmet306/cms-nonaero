import { apiClient } from './client';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  taxId: string;
  status: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency: string;
  airportId: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDto {
  name: string;
  taxId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency: string;
  airportId: string;
}

export interface UpdateTenantDto {
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function getTenants(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<PaginatedResponse<Tenant>>('/tenants', { params });
  return data;
}

export async function getTenant(id: string) {
  const { data } = await apiClient.get<Tenant>(`/tenants/${id}`);
  return data;
}

export async function createTenant(dto: CreateTenantDto) {
  const { data } = await apiClient.post<Tenant>('/tenants', dto);
  return data;
}

export async function updateTenant(id: string, dto: UpdateTenantDto) {
  const { data } = await apiClient.patch<Tenant>(`/tenants/${id}`, dto);
  return data;
}
