import type { ActivityDTO, Channel, Direction } from 'src/common';
import { apiClient } from './client';

export async function fetchActivities(
  params: { person_id?: string; company_id?: string; opportunity_id?: string } = {},
) {
  const response = await apiClient.get<ActivityDTO[]>('/activities', { params });
  return response.data;
}

export interface NewActivity {
  person_id?: string | null;
  company_id?: string | null;
  opportunity_id?: string | null;
  entry_id?: string | null;
  channel: Channel;
  direction: Direction;
  occurred_at?: string;
  subject?: string | null;
  body?: string | null;
}

export async function createActivity(payload: NewActivity) {
  const response = await apiClient.post<ActivityDTO>('/activities', payload);
  return response.data;
}
