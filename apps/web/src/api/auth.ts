import type { Role } from 'src/common';
import { apiClient, setAuthToken } from './client';

interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    email: string;
    name: string;
    role: Role;
    organization_id: string;
  };
}

export async function signup(payload: {
  email: string;
  password: string;
  name: string;
  /** The code carries the organisation and the role - neither is sent by the client. */
  invite_code: string;
}) {
  const response = await apiClient.post<AuthResponse>('/auth/signup', payload);
  setAuthToken(response.data.token);
  return response.data;
}

export async function login(payload: { email: string; password: string }) {
  const response = await apiClient.post<AuthResponse>('/auth/login', payload);
  setAuthToken(response.data.token);
  return response.data;
}
