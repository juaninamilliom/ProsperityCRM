import type { StatusDTO } from '@prosperity/common';
import { apiClient } from './client';

export async function fetchStatuses() {
  const response = await apiClient.get<StatusDTO[]>('/statuses');
  return response.data;
}

export async function createStatus(payload: Omit<StatusDTO, 'status_id'>) {
  const response = await apiClient.post('/statuses', payload);
  return response.data as StatusDTO;
}

export async function updateStatus(statusId: string, payload: Partial<StatusDTO>) {
  const response = await apiClient.put(`/statuses/${statusId}`, payload);
  return response.data as StatusDTO;
}
