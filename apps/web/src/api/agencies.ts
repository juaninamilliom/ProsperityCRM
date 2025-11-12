import type { AgencyDTO } from '@prosperity/common';
import { apiClient } from './client';

export async function fetchAgencies() {
  const response = await apiClient.get<AgencyDTO[]>('/agencies');
  return response.data;
}

export async function createAgency(payload: Omit<AgencyDTO, 'agency_id'>) {
  const response = await apiClient.post('/agencies', payload);
  return response.data as AgencyDTO;
}

export async function updateAgency(agencyId: string, payload: Partial<AgencyDTO>) {
  const response = await apiClient.put(`/agencies/${agencyId}`, payload);
  return response.data as AgencyDTO;
}
