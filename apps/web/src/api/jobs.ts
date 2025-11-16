import type { JobRequisitionDTO } from 'src/common';
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
