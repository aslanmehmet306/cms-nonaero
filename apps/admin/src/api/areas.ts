import { apiClient } from './client';

export interface Area {
  id: string;
  name: string;
  code: string;
  type: string;
  airportId: string;
  parentAreaId?: string;
  size?: number;
  children?: Area[];
}

export async function getAreas(params?: Record<string, string | undefined>) {
  const { data } = await apiClient.get<Area[]>('/areas', { params });
  return data;
}

export async function getAreaRoots() {
  const { data } = await apiClient.get<Area[]>('/areas/roots');
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
