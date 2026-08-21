import type { ContactRole, OpportunityDTO, OpportunityStage } from 'src/common';
import { apiClient } from './client';

export async function fetchOpportunities(params: { company_id?: string; stage?: OpportunityStage } = {}) {
  const response = await apiClient.get<OpportunityDTO[]>('/opportunities', { params });
  return response.data;
}

export async function fetchOpportunity(opportunityId: string) {
  const response = await apiClient.get<OpportunityDTO>(`/opportunities/${opportunityId}`);
  return response.data;
}

export async function createOpportunity(payload: Partial<OpportunityDTO> & { company_id: string; name: string }) {
  const response = await apiClient.post<OpportunityDTO>('/opportunities', payload);
  return response.data;
}

export async function updateOpportunity(opportunityId: string, payload: Partial<OpportunityDTO>) {
  const response = await apiClient.patch<OpportunityDTO>(`/opportunities/${opportunityId}`, payload);
  return response.data;
}

/** Stage changes go through their own route: this is what promotes the company
 *  to a client and logs the win. A plain update cannot set a stage. */
export async function moveStage(opportunityId: string, stage: OpportunityStage, lostReason?: string) {
  const response = await apiClient.patch<OpportunityDTO>(`/opportunities/${opportunityId}/stage`, {
    stage,
    lost_reason: lostReason,
  });
  return response.data;
}

export async function addOpportunityContact(
  opportunityId: string,
  personId: string,
  role?: ContactRole,
) {
  const response = await apiClient.post<OpportunityDTO>(`/opportunities/${opportunityId}/contacts`, {
    person_id: personId,
    role,
  });
  return response.data;
}

export async function removeOpportunityContact(opportunityId: string, personId: string) {
  await apiClient.delete(`/opportunities/${opportunityId}/contacts/${personId}`);
}
