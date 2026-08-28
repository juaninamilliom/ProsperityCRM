import type { ContactInfo, ParsedCandidateProfile } from '../content/linkedin-parser';

export interface ExtractResponse {
  success: boolean;
  profile: ParsedCandidateProfile | null;
  trace: string[];
}

export interface ContactResponse {
  success: boolean;
  contact: ContactInfo | null;
  source: 'modal' | 'overlay-fetch' | 'none';
  trace: string[];
}

const NO_RECEIVER = /Receiving end does not exist|Could not establish connection/i;

function sendToTab<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response as T);
    });
  });
}

/** A tab opened before the extension was installed (or reloaded) has no
 *  content script. Inject the bundled one rather than serialising the parser
 *  into executeScript, which would strip its helper functions. */
async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await sendToTab(tabId, { type: 'PING' });
    return;
  } catch (error) {
    if (!NO_RECEIVER.test(String(error))) throw error;
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

export async function extractFromTab(tabId: number): Promise<ExtractResponse> {
  await ensureContentScript(tabId);
  return sendToTab<ExtractResponse>(tabId, { type: 'EXTRACT_PROFILE' });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function completeness(profile: ParsedCandidateProfile | null): number {
  if (!profile) return 0;
  return [profile.full_name, profile.headline, profile.current_title, profile.current_company, profile.location].filter(Boolean).length;
}

/** LinkedIn hydrates the top card first and the experience section a beat
 *  later; a first read often has the name but not the role. Re-read until
 *  the result stops improving. */
export async function extractWithRetry(tabId: number, attempts = 3, delayMs = 700): Promise<ExtractResponse> {
  let best: ExtractResponse = { success: false, profile: null, trace: [] };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await extractFromTab(tabId);
    if (completeness(result.profile) > completeness(best.profile)) best = result;
    const done = best.profile && best.profile.current_title && best.profile.current_company;
    if (done || attempt === attempts) break;
    await wait(delayMs);
  }
  return best;
}

export async function fetchContactFromTab(tabId: number): Promise<ContactResponse> {
  await ensureContentScript(tabId);
  return sendToTab<ContactResponse>(tabId, { type: 'FETCH_CONTACT_INFO' });
}

export async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}
