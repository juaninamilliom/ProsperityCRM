// Prosperity CRM API Client for Chrome Extension

export interface StoredConfig {
  apiUrl: string;
  token: string;
}

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
}

export interface JobRequisition {
  job_id: string;
  title: string;
  status: string;
  company_name: string | null;
}

export interface StatusConfig {
  status_id: string;
  name: string;
  order_index: number;
}

export interface CandidateDuplicateResult {
  isDuplicate: boolean;
  person?: {
    person_id: string;
    full_name: string;
    headline?: string;
    current_title?: string;
    company_name?: string;
  };
}

const DEFAULT_API_URL = 'https://prosperitycrm.onrender.com';

export async function getStoredConfig(): Promise<StoredConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiUrl', 'token'], (result) => {
      resolve({
        apiUrl: result.apiUrl || DEFAULT_API_URL,
        token: result.token || '',
      });
    });
  });
}

export async function saveStoredConfig(config: Partial<StoredConfig>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(config, () => resolve());
  });
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { apiUrl, token } = await getStoredConfig();
  const cleanApiUrl = apiUrl.replace(/\/+$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${cleanApiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.statusText} (${response.status})`);
  }

  return response.json();
}

export async function fetchMe(): Promise<{ tokenUser?: any; dbUser: User }> {
  return apiRequest('/users/me');
}

export async function fetchJobs(): Promise<JobRequisition[]> {
  return apiRequest('/jobs');
}

export async function fetchStatuses(): Promise<StatusConfig[]> {
  return apiRequest('/statuses');
}

export async function checkLinkedInMatch(linkedinUrl: string): Promise<CandidateDuplicateResult> {
  try {
    const people = await apiRequest<any[]>(`/people?search=${encodeURIComponent(linkedinUrl)}`);
    if (people && people.length > 0) {
      return {
        isDuplicate: true,
        person: people[0],
      };
    }
  } catch {}
  return { isDuplicate: false };
}

export async function importCandidateToCRM(payload: {
  full_name: string;
  headline?: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  linkedin_url: string;
  skills?: string[];
  notes?: string;
  email?: string;
  phone?: string;
  job_id?: string;
  status_id?: string;
}) {
  // 1. Create person
  const person = await apiRequest<any>('/people', {
    method: 'POST',
    body: JSON.stringify({
      full_name: payload.full_name,
      headline: payload.headline,
      current_title: payload.current_title,
      location: payload.location,
      linkedin_url: payload.linkedin_url,
      skills: payload.skills || [],
      notes: payload.notes,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      source: 'linkedin_capture',
    }),
  });

  // 2. If a Job is selected, create pipeline entry
  if (payload.job_id && person?.person?.person_id) {
    const personId = person.person.person_id;
    // Find company from job or create placeholder
    await apiRequest('/pipeline-entries', {
      method: 'POST',
      body: JSON.stringify({
        person_id: personId,
        job_id: payload.job_id,
        current_status_id: payload.status_id,
        notes: payload.notes,
      }),
    }).catch((err) => {
      console.warn('Could not create pipeline entry immediately:', err);
    });
  }

  return person;
}
