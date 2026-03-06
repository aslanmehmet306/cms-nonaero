import { apiClient } from './client';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    sub: string;
    email: string;
    role: string;
    airportId?: string;
    tenantId?: string;
  };
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/auth/admin/login',
    { email, password },
  );
  return data;
}

export async function refreshToken(
  refresh_token: string,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/auth/admin/refresh',
    { refresh_token },
  );
  return data;
}

export async function getMe(): Promise<AuthResponse['user']> {
  const { data } = await apiClient.get<AuthResponse['user']>('/auth/me');
  return data;
}
