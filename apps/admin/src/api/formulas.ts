import { apiClient } from './client';

export interface Formula {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  expression: string;
  customParameters?: Record<string, number>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DryRunResult {
  result: number;
  trace?: string[];
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function getFormulas(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<PaginatedResponse<Formula>>('/formulas', { params });
  return data;
}

export async function getFormula(id: string) {
  const { data } = await apiClient.get<Formula>(`/formulas/${id}`);
  return data;
}

export async function createFormula(dto: Partial<Formula>) {
  const { data } = await apiClient.post<Formula>('/formulas', dto);
  return data;
}

export async function updateFormula(id: string, dto: Partial<Formula>) {
  const { data } = await apiClient.patch<Formula>(`/formulas/${id}`, dto);
  return data;
}

export async function publishFormula(id: string) {
  const { data } = await apiClient.post<Formula>(`/formulas/${id}/publish`);
  return data;
}

export async function newFormulaVersion(id: string) {
  const { data } = await apiClient.post<Formula>(`/formulas/${id}/new-version`);
  return data;
}

export async function deprecateFormula(id: string) {
  const { data } = await apiClient.post<Formula>(`/formulas/${id}/deprecate`);
  return data;
}

export async function dryRunFormula(id: string, variables?: Record<string, number>) {
  const { data } = await apiClient.post<DryRunResult>(`/formulas/${id}/dry-run`, { variables });
  return data;
}
