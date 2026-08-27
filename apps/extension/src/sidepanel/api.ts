// Prosperity CRM API Client & Authentication Engine for Chrome Extension
export const API_URL = 'https://prosperitycrm.onrender.com';
export const WEB_APP_URL = 'https://prosperity-crm-web.vercel.app';

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
  company_id?: string | null;
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

export async function getAuthToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (result) => {
      resolve(result.token || '');
    });
  });
}

export async function saveAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ token }, () => resolve());
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
          return (
            localStorage.getItem('prosperity_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('auth_token')
          );
        },
      });

      const detectedToken = results?.[0]?.result;
      if (detectedToken && typeof detectedToken === 'string') {
        await saveAuthToken(detectedToken);
        return detectedToken;
      }
    }
  } catch (err) {
    console.debug('Auto-detect web session not available:', err);
  }
  return null;
}

/** Launches 1-click Touch ID / Passkey web authentication bridge */
export async function launchPasskeyAuthBridge(): Promise<string | null> {
  const tab = await chrome.tabs.create({
    url: `${WEB_APP_URL}/login?extension_auth=1`,
    active: true,
  });

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        if (!tab.id) {
          clearInterval(interval);
          resolve(null);
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return (
              localStorage.getItem('prosperity_token') ||
              localStorage.getItem('token') ||
              localStorage.getItem('auth_token')
            );
          },
        });
        const token = results?.[0]?.result;
        if (token && typeof token === 'string') {
          clearInterval(interval);
          await saveAuthToken(token);
          // Auto close the login helper tab
          chrome.tabs.remove(tab.id).catch(() => {});
          resolve(token);
        }
      } catch {
        // Tab navigating or closing
      }
    }, 600);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 120000);
  });
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
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
  await saveAuthToken(res.token);
  return res;
}

export async function loginWithPassword(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  await saveAuthToken(res.token);
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
  company_id?: string;
  status_id?: string;
  existing_person_id?: string;
}) {
  let personId = payload.existing_person_id;
  let personData: any = null;

  if (personId) {
    // 1. Existing candidate: update details if changed
    try {
      personData = await apiRequest(`/people/${personId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          headline: payload.headline || undefined,
          current_title: payload.current_title || undefined,
          current_company: payload.current_company || undefined,
          company_name: payload.current_company || undefined,
          location: payload.location || undefined,
          skills: payload.skills && payload.skills.length > 0 ? payload.skills : undefined,
          email: payload.email || undefined,
          phone: payload.phone || undefined,
        }),
      });
    } catch (e) {
      console.warn('Could not patch existing person:', e);
    }
  } else {
    // 2. New candidate: create person (or gracefully resolve duplicate)
    try {
      const res = await apiRequest<any>('/people', {
        method: 'POST',
        body: JSON.stringify({
          full_name: payload.full_name,
          headline: payload.headline,
          current_title: payload.current_title,
          current_company: payload.current_company,
          company_name: payload.current_company,
          location: payload.location,
          linkedin_url: payload.linkedin_url,
          skills: payload.skills || [],
          notes: payload.notes,
          email: payload.email || undefined,
          phone: payload.phone || undefined,
          source: 'linkedin_capture',
        }),
      });
      personData = res;
      personId = res?.person?.person_id || res?.person_id;
    } catch (err: any) {
      // If candidate already exists in database, resolve their ID
      const match = await checkLinkedInMatch(payload.linkedin_url);
      if (match.person?.person_id) {
        personId = match.person.person_id;
      } else {
        throw err;
      }
    }
  }

  // 3. If note is present, record as timestamped Activity note
  if (personId && payload.notes && payload.notes.trim().length > 0) {
    await apiRequest('/activities', {
      method: 'POST',
      body: JSON.stringify({
        person_id: personId,
        channel: 'note',
        direction: 'internal',
        body: payload.notes.trim(),
      }),
    }).catch((err) => {
      console.warn('Could not record activity note:', err);
    });
  }

  // 4. If assigned to a job requisition, create pipeline entry
  if (personId && payload.job_id && payload.status_id) {
    const me = await fetchMe().catch(() => null);
    const recruiterId = me?.dbUser?.user_id || me?.tokenUser?.user_id;

    if (payload.company_id && recruiterId) {
      await apiRequest('/pipeline-entries', {
        method: 'POST',
        body: JSON.stringify({
          person_id: personId,
          company_id: payload.company_id,
          job_id: payload.job_id,
          current_status_id: payload.status_id,
          recruiter_id: recruiterId,
          notes: payload.notes || undefined,
        }),
      }).catch((err) => {
        console.warn('Could not create pipeline entry:', err);
      });
    }
  }

  return { personId, person: personData };
}
