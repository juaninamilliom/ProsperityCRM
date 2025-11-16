import type { OrganizationSkillDTO } from 'src/common';
import { apiClient } from './client';

export async function fetchSkills() {
  const response = await apiClient.get<OrganizationSkillDTO[]>('/skills');
  return response.data;
}

export async function createSkill(name: string) {
  const response = await apiClient.post<OrganizationSkillDTO>('/skills', { name });
  return response.data;
}
