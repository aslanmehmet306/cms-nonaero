import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  airportId: string | null;
  airport?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListParams {
  role?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: string;
  airportId?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: string;
  airportId?: string;
}

export async function getUsers(params?: UserListParams): Promise<UserListResponse> {
  const { data } = await apiClient.get<UserListResponse>('/users', { params });
  return data;
}

export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/users/${id}`);
  return data;
}

export async function createUser(payload: CreateUserData): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload);
  return data;
}

export async function updateUser(
  id: string,
  payload: UpdateUserData,
): Promise<User> {
  const { data } = await apiClient.patch<User>(`/users/${id}`, payload);
  return data;
}
