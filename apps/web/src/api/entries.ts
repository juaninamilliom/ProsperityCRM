import type { PipelineEntryDTO, PipelineEntryWithMeta } from 'src/common';
import { apiClient } from './client';

export interface EntryFilters {
  flag?: string;
  company_id?: string;
  person_id?: string;
  job_id?: string;
  status_id?: string;
  search?: string;
  skills?: string[];
}

export async function fetchEntries(filters: EntryFilters = {}) {
  const response = await apiClient.get<PipelineEntryWithMeta[]>('/pipeline-entries', {
    params: {
      ...filters,
      skills: filters.skills?.length ? filters.skills.join(',') : undefined,
    },
  });
  return response.data;
}

export async function fetchEntry(entryId: string) {
  const response = await apiClient.get<PipelineEntryWithMeta>(`/pipeline-entries/${entryId}`);
  return response.data;
}

export async function moveEntry(entryId: string, toStatusId: string) {
  const response = await apiClient.post(`/pipeline-entries/${entryId}/move_status`, {
    to_status_id: toStatusId,
  });
  return response.data as PipelineEntryDTO;
}

export async function createEntry(payload: Partial<PipelineEntryDTO>) {
  const response = await apiClient.post('/pipeline-entries', payload);
  return response.data as PipelineEntryDTO;
}

export async function updateEntry(entryId: string, payload: Partial<PipelineEntryDTO>) {
  const response = await apiClient.put(`/pipeline-entries/${entryId}`, payload);
  return response.data as PipelineEntryDTO;
}
