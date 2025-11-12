import type { Role } from '@prosperity/common';
import { apiClient } from './client';

export interface InviteCode {
  code_id: string;
  organization_id: string;
  code: string;
  role: Role;
  status: 'active' | 'used' | 'revoked';
  used_count: number;
  max_uses: number;
  created_at: string;
}

export async function fetchInviteCodes(orgId: string) {
  const response = await apiClient.get<InviteCode[]>(`/organizations/${orgId}/invite-codes`);
  return response.data;
}

export async function createInviteCode(orgId: string, params: { role: Role; maxUses?: number }) {
  const response = await apiClient.post<InviteCode>(`/organizations/${orgId}/invite-codes`, params);
  return response.data;
}

export async function revokeInvite(code: string) {
  await apiClient.post(`/invite-codes/${code}/revoke`);
}
