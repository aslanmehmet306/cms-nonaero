import { apiClient } from './client';

export interface Airport {
  id: string;
  name: string;
  iataCode: string;
  icaoCode: string;
  city: string;
  country: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAirportData {
  name?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

export async function getAirports(): Promise<Airport[]> {
  const { data } = await apiClient.get<Airport[]>('/airports');
  return data;
}

export async function getAirport(id: string): Promise<Airport> {
  const { data } = await apiClient.get<Airport>(`/airports/${id}`);
  return data;
}

export async function updateAirport(
  id: string,
  payload: UpdateAirportData,
): Promise<Airport> {
  const { data } = await apiClient.patch<Airport>(
    `/airports/${id}`,
    payload,
  );
  return data;
}
