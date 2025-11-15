import type { CandidateDTO, CandidateWithMeta } from 'src/common';
import { apiClient } from './client';

export interface CandidateFilters {
  flag?: string;
  agency_id?: string;
}

export async function fetchCandidates(filters: CandidateFilters = {}) {
  const response = await apiClient.get<CandidateWithMeta[]>('/candidates', { params: filters });
  return response.data;
}

export async function moveCandidate(candidateId: string, toStatusId: string) {
  const response = await apiClient.post(`/candidates/${candidateId}/move_status`, {
    to_status_id: toStatusId,
  });
  return response.data as CandidateDTO;
}

export async function createCandidate(payload: Partial<CandidateDTO>) {
  const response = await apiClient.post('/candidates', payload);
  return response.data as CandidateDTO;
}
