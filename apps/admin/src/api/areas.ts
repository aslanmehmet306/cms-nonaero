import { apiClient } from './client';

export interface Area {
  id: string;
  name: string;
  code: string;
  areaType: string;
  airportId: string;
  parentAreaId?: string | null;
  areaM2?: number | null;
  isLeasable?: boolean;
  isActive?: boolean;
  children?: Area[];
  parent?: Area | null;
}

export interface CreateAreaPayload {
  airportId: string;
  parentAreaId?: string;
  code: string;
  name: string;
  areaType: string;
  areaM2?: number;
  isLeasable?: boolean;
}

export interface UpdateAreaPayload {
  code?: string;
  name?: string;
  areaType?: string;
  areaM2?: number;
  isLeasable?: boolean;
  isActive?: boolean;
}

export async function getAreas(params?: Record<string, string | undefined>) {
  const { data } = await apiClient.get<Area[]>('/areas', { params });
  return data;
}

export async function getAreaRoots(params?: Record<string, string | undefined>) {
  const { data } = await apiClient.get<Area[]>('/areas/roots', { params });
  return data;
}

export async function getArea(id: string) {
  const { data } = await apiClient.get<Area>(`/areas/${id}`);
  return data;
}

export async function getAreaTree(id: string) {
  const { data } = await apiClient.get<Area>(`/areas/${id}/tree`);
  return data;
}

export async function createArea(payload: CreateAreaPayload) {
  const { data } = await apiClient.post<Area>('/areas', payload);
  return data;
}

export async function updateArea(id: string, payload: UpdateAreaPayload) {
  const { data } = await apiClient.patch<Area>(`/areas/${id}`, payload);
  return data;
}
