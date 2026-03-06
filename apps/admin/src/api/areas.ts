import { apiClient } from './client';

export interface Meter {
  id: string;
  areaId: string;
  serialNumber: string;
  meterType: string;
  location?: string | null;
  isActive?: boolean;
  installedAt?: string | null;
}

export interface Area {
  id: string;
  name: string;
  code: string;
  areaType: string;
  airportId: string;
  parentAreaId?: string | null;
  areaM2?: number | null;
  heightM?: number | null;
  unitClassification?: string | null;
  isLeasable?: boolean;
  isActive?: boolean;
  children?: Area[];
  parent?: Area | null;
  meters?: Meter[];
}

export interface CreateAreaPayload {
  airportId: string;
  parentAreaId?: string;
  code: string;
  name: string;
  areaType: string;
  areaM2?: number;
  heightM?: number;
  unitClassification?: string;
  isLeasable?: boolean;
}

export interface UpdateAreaPayload {
  code?: string;
  name?: string;
  areaType?: string;
  areaM2?: number;
  heightM?: number;
  unitClassification?: string;
  isLeasable?: boolean;
  isActive?: boolean;
}

export interface CreateMeterPayload {
  areaId: string;
  serialNumber: string;
  meterType: string;
  location?: string;
  isActive?: boolean;
  installedAt?: string;
}

export interface UpdateMeterPayload {
  serialNumber?: string;
  meterType?: string;
  location?: string;
  isActive?: boolean;
  installedAt?: string;
}

// ---- Area endpoints ----

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

// ---- Meter endpoints ----

export async function getMeters(areaId: string) {
  const { data } = await apiClient.get<Meter[]>('/meters', { params: { areaId } });
  return data;
}

export async function createMeter(payload: CreateMeterPayload) {
  const { data } = await apiClient.post<Meter>('/meters', payload);
  return data;
}

export async function updateMeter(id: string, payload: UpdateMeterPayload) {
  const { data } = await apiClient.patch<Meter>(`/meters/${id}`, payload);
  return data;
}

export async function deleteMeter(id: string) {
  const { data } = await apiClient.delete(`/meters/${id}`);
  return data;
}
