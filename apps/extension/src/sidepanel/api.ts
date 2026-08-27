// Prosperity CRM API Client & Authentication Engine for Chrome Extension
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

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

export async function clearAuthSession(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove('token', () => resolve());
  });
}

/** Automatically detects active web CRM login session from open tabs */
export async function autoDetectWebSession(): Promise<string | null> {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://prosperity-crm-web.vercel.app/*',
        'http://localhost:*/*',
      ],
    });

    for (const tab of tabs) {
      if (!tab.id) continue;
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return localStorage.getItem('token') || localStorage.getItem('auth_token');
        },
      });

      const detectedToken = results?.[0]?.result;
      if (detectedToken && typeof detectedToken === 'string') {
        await saveStoredConfig({ token: detectedToken });
        return detectedToken;
      }
    }
  } catch (err) {
    console.debug('Auto-detect web session not available:', err);
  }
  return null;
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

// ─── Authentication Methods ──────────────────────────────────────────────────

export async function isPasskeySupported(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export async function loginWithPasskey(email?: string): Promise<{ token: string; user: User }> {
  // 1. Get challenge options
  const { options, challengeId } = await apiRequest<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }>('/auth/passkey/login-options', {
    method: 'POST',
    body: JSON.stringify({ email: email?.trim() || undefined }),
  });

  // 2. Prompt Touch ID / Face ID / Device Biometrics
  const credential = await startAuthentication({ optionsJSON: options });

  // 3. Verify signature
  const res = await apiRequest<{ token: string; user: User }>('/auth/passkey/login-verify', {
    method: 'POST',
    body: JSON.stringify({
      response: credential,
      challengeId,
    }),
  });

  await saveStoredConfig({ token: res.token });
  return res;
}

export async function requestMagicLink(email: string): Promise<{ message: string; devUrl?: string }> {
  return apiRequest('/auth/magic-link/request', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function verifyMagicLink(token: string): Promise<{ token: string; user: User }> {
  const res = await apiRequest<{ token: string; user: User }>('/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token: token.trim() }),
  });
  await saveStoredConfig({ token: res.token });
  return res;
}

export async function loginWithPassword(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  await saveStoredConfig({ token: res.token });
  return res;
}

export async function fetchMe(): Promise<{ tokenUser?: any; dbUser: User }> {
  return apiRequest('/users/me');
}

// ─── CRM Data Methods ────────────────────────────────────────────────────────

export async function fetchJobs(): Promise<JobRequisition[]> {
  return apiRequest('/jobs');
}

export async function fetchStatuses(): Promise<StatusConfig[]> {
  return apiRequest('/statuses');
}

export async function checkLinkedInMatch(linkedinUrl: string): Promise<CandidateDuplicateResult> {
  try {
    const res = await apiRequest<{ match: boolean; person?: any }>(
      `/people/lookup-linkedin?url=${encodeURIComponent(linkedinUrl)}`
    );
    if (res?.match && res?.person) {
      return { isDuplicate: true, person: res.person };
    }
  } catch {}

  try {
    const people = await apiRequest<any[]>(`/people?search=${encodeURIComponent(linkedinUrl)}`);
    if (people && people.length > 0) {
      return { isDuplicate: true, person: people[0] };
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

  if (payload.job_id && person?.person?.person_id) {
    const personId = person.person.person_id;
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
