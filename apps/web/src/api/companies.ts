import type { CompanyDTO, CompanyDetailDTO, Relationship } from 'src/common';
import { apiClient } from './client';

export async function fetchCompanies(params: { relationship?: Relationship; search?: string } = {}) {
  const response = await apiClient.get<CompanyDTO[]>('/companies', { params });
  return response.data;
}

export async function fetchCompany(companyId: string) {
  const response = await apiClient.get<CompanyDetailDTO>(`/companies/${companyId}`);
  return response.data;
}

export async function createCompany(payload: Partial<CompanyDTO> & { name: string }) {
  const response = await apiClient.post<CompanyDTO>('/companies', payload);
  return response.data;
}

export async function updateCompany(companyId: string, payload: Partial<CompanyDTO>) {
  const response = await apiClient.patch<CompanyDTO>(`/companies/${companyId}`, payload);
  return response.data;
}
