import type { UserDTO } from '@prosperity/common';
import { apiClient } from './client';

export interface CurrentUserResponse {
  tokenUser: {
    sub: string;
    email?: string;
    name?: string;
  } | null;
  dbUser: UserDTO | null;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<CurrentUserResponse>('/users/me');
  return response.data;
}

export async function updateUserRole(userId: string, role: 'OrgAdmin' | 'OrgEmployee') {
  const response = await apiClient.patch<UserDTO>(`/users/${userId}/role`, { role });
  return response.data;
}
