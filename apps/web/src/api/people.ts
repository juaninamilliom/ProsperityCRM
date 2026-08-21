import type { PersonDTO, PersonDetailDTO } from 'src/common';
import { apiClient } from './client';

export async function fetchPeople(params: { search?: string; company_id?: string } = {}) {
  const response = await apiClient.get<PersonDTO[]>('/people', { params });
  return response.data;
}

export async function fetchPerson(personId: string) {
  const response = await apiClient.get<PersonDetailDTO>(`/people/${personId}`);
  return response.data;
}

export async function createPerson(payload: Partial<PersonDTO> & { full_name: string }) {
  const response = await apiClient.post<PersonDTO>('/people', payload);
  return response.data;
}

export async function updatePerson(personId: string, payload: Partial<PersonDTO>) {
  const response = await apiClient.patch<PersonDTO>(`/people/${personId}`, payload);
  return response.data;
}
