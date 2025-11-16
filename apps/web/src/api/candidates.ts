import type { CandidateDTO, CandidateWithMeta } from 'src/common';
import { apiClient } from './client';

export interface CandidateFilters {
  flag?: string;
  agency_id?: string;
  job_id?: string;
  status_id?: string;
  search?: string;
}

export async function fetchCandidates(filters: CandidateFilters = {}) {
  const response = await apiClient.get<CandidateWithMeta[]>('/candidates', { params: filters });
  return response.data;
}

export async function fetchCandidate(candidateId: string) {
  const response = await apiClient.get<CandidateWithMeta>(`/candidates/${candidateId}`);
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

export async function updateCandidate(candidateId: string, payload: Partial<CandidateDTO>) {
  const response = await apiClient.put(`/candidates/${candidateId}`, payload);
  return response.data as CandidateDTO;
}
