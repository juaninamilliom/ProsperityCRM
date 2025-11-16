import type { CandidateWithMeta, JobDealSplitDTO, JobDetailDTO, JobRequisitionDTO } from 'src/common';
import { apiClient } from './client';

export async function fetchJobs() {
  const response = await apiClient.get<JobRequisitionDTO[]>('/jobs');
  return response.data;
}

export async function createJob(payload: Partial<JobRequisitionDTO>) {
  const response = await apiClient.post<JobRequisitionDTO>('/jobs', payload);
  return response.data;
}

export async function updateJob(jobId: string, payload: Partial<JobRequisitionDTO>) {
  const response = await apiClient.put<JobRequisitionDTO>(`/jobs/${jobId}`, payload);
  return response.data;
}

export async function deleteJob(jobId: string) {
  await apiClient.delete(`/jobs/${jobId}`);
}

export interface JobDetailPayload {
  job: JobDetailDTO;
  splits: JobDealSplitDTO[];
  candidates: CandidateWithMeta[];
}

export async function fetchJobDetail(jobId: string) {
  const response = await apiClient.get<JobDetailPayload>(`/jobs/${jobId}`);
  return response.data;
}

export type JobSplitInput = {
  teammate_name: string;
  teammate_status?: string;
  role?: string;
  split_percent?: string;
  total_deal?: string;
  weighted_deal?: string;
};

export async function saveJobSplits(jobId: string, splits: JobSplitInput[]) {
  const response = await apiClient.put<JobDealSplitDTO[]>(`/jobs/${jobId}/splits`, { splits });
  return response.data;
}
