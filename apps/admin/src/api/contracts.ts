import { apiClient } from './client';

// ---- Types ----

export interface Contract {
  id: string;
  contractNumber: string;
  version: number;
  tenantId: string;
  tenant?: { id: string; name: string; code: string };
  airportId: string;
  status: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  title?: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractArea {
  id: string;
  contractId: string;
  areaId: string;
  area?: { id: string; name: string; code: string; type: string };
  areaM2?: string;
}

export interface ContractService {
  id: string;
  contractId: string;
  serviceDefinitionId: string;
  serviceDefinition?: { id: string; name: string; type: string };
  overrideFormulaId?: string;
  overrideFormula?: { id: string; name: string };
}

export interface ContractVersion {
  id: string;
  contractNumber: string;
  version: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string;
  createdAt: string;
}

export interface CreateContractDto {
  title?: string;
  tenantId: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  description?: string;
}

export interface UpdateContractDto {
  title?: string;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  description?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---- API functions ----

export async function getContracts(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<PaginatedResponse<Contract>>('/contracts', { params });
  return data;
}

export async function getContract(id: string) {
  const { data } = await apiClient.get<Contract>(`/contracts/${id}`);
  return data;
}

export async function createContract(dto: CreateContractDto) {
  const { data } = await apiClient.post<Contract>('/contracts', dto);
  return data;
}

export async function updateContract(id: string, dto: UpdateContractDto) {
  const { data } = await apiClient.patch<Contract>(`/contracts/${id}`, dto);
  return data;
}

export async function transitionContract(id: string, status: string) {
  const { data } = await apiClient.post<Contract>(`/contracts/${id}/transition`, { status });
  return data;
}

export async function amendContract(id: string, effectiveFrom: string) {
  const { data } = await apiClient.post<Contract>(`/contracts/${id}/amend`, { effectiveFrom });
  return data;
}

export async function getContractVersions(id: string) {
  const { data } = await apiClient.get<ContractVersion[]>(`/contracts/${id}/versions`);
  return data;
}

export async function getContractSnapshot(id: string) {
  const { data } = await apiClient.get(`/contracts/${id}/snapshot`);
  return data;
}

// ---- Contract areas ----

export async function addContractArea(contractId: string, dto: { areaId: string; areaM2?: number }) {
  const { data } = await apiClient.post<ContractArea>(`/contracts/${contractId}/areas`, dto);
  return data;
}

export async function getContractAreas(contractId: string) {
  const { data } = await apiClient.get<ContractArea[]>(`/contracts/${contractId}/areas`);
  return data;
}

export async function removeContractArea(contractId: string, areaId: string) {
  await apiClient.delete(`/contracts/${contractId}/areas/${areaId}`);
}

// ---- Contract services ----

export async function addContractService(contractId: string, dto: { serviceDefinitionId: string; overrideFormulaId?: string }) {
  const { data } = await apiClient.post<ContractService>(`/contracts/${contractId}/services`, dto);
  return data;
}

export async function getContractServices(contractId: string) {
  const { data } = await apiClient.get<ContractService[]>(`/contracts/${contractId}/services`);
  return data;
}

export async function removeContractService(contractId: string, serviceId: string) {
  await apiClient.delete(`/contracts/${contractId}/services/${serviceId}`);
}
