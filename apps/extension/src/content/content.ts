import {
  extractProfile,
  isContactOverlayRendered,
  isLinkedInProfileUrl,
  isNewProfileUi,
  parseContactInfoFromHtml,
  parseContactInfoModal,
  profileSlugFromUrl,
  type ContactInfo,
  type ParsedCandidateProfile,
} from './linkedin-parser';
import { PROTOCOL_VERSION, type ProfileUpdatedMessage } from './protocol';

export type ContactFetchResult = {
  success: boolean;
  contact: ContactInfo | null;
  source: 'modal' | 'overlay-fetch' | 'none';
  trace: string[];
};

declare global {
  interface Window {
    __prosperityContentVersion?: number;
  }
}

const TAG = '%c[Prosperity CRM]%c';
const TAG_STYLE = ['color:#5b5bd6;font-weight:bold', 'color:inherit'];

function logTrace(title: string, trace: string[]) {
  console.groupCollapsed(`${TAG} ${title}`, ...TAG_STYLE);
  trace.forEach((line) => console.log(line));
  console.groupEnd();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(probe: () => T | null, timeoutMs: number, everyMs = 150): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = probe();
    if (value !== null) return value;
    await wait(everyMs);
  }
  return null;
}

/** The overlay renders its rows in one go once the API call returns; rows
 *  without an email or phone mean the person shares nothing. */
function renderedContactInfo(): ContactInfo | null {
  if (!isContactOverlayRendered(document)) return null;
  return parseContactInfoModal(document);
}

async function closeOverlay() {
  const dismiss = document.querySelector<HTMLElement>(
    'dialog[open] button[aria-label="Dismiss"], dialog[data-testid="dialog"] button[aria-label="Dismiss"], .artdeco-modal button[aria-label="Dismiss"], .artdeco-modal__dismiss, [role="dialog"] button[aria-label="Dismiss"]',
  );
  dismiss?.click();
  await wait(400);
  const stillOpen = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (stillOpen) {
    try {
      stillOpen.close();
    } catch {
      // not a native dialog
    }
  }
  if (/\/overlay\//.test(window.location.pathname)) window.history.back();
}

/**
 * Contact details live behind the "Contact info" link, not in the profile
 * DOM. Three layers, cheapest first:
 *   1. the overlay is already open - read it
 *   2. (legacy layout) fetch the overlay route and read its embedded payload
 *   3. click the link, read the rendered overlay, dismiss it
 */
async function fetchContactInfo(): Promise<ContactFetchResult> {
  const trace: string[] = [];
  const slug = profileSlugFromUrl(window.location.href);
  if (!slug) return { success: false, contact: null, source: 'none', trace: ['Not on a profile page'] };

  const open = renderedContactInfo();
  if (open) {
    trace.push('Read the contact-info overlay that was already open');
    return { success: true, contact: open, source: 'modal', trace };
  }

  // The 2025 layout serves the overlay route as a 1 MB shell with no embedded
  // contact payload, so the fetch is only worth it on the legacy layout.
  const overlayUrl = `${window.location.origin}/in/${encodeURIComponent(slug)}/overlay/contact-info/`;
  if (isNewProfileUi(document)) {
    trace.push('2025 layout: skipping the overlay fetch (no embedded payload); opening the overlay');
  } else
    try {
      const response = await fetch(overlayUrl, { credentials: 'include', headers: { accept: 'text/html' } });
      trace.push(`Fetched ${overlayUrl} → HTTP ${response.status}`);
      if (response.ok) {
        const info = parseContactInfoFromHtml(await response.text(), slug);
        if (info) {
          trace.push('Contact payload found in the overlay page');
          return { success: true, contact: info, source: 'overlay-fetch', trace };
        }
        trace.push('Overlay page carried no contact payload; opening the overlay instead');
      }
    } catch (error) {
      trace.push(`Overlay fetch failed: ${String(error)}`);
    }

  const link = document.querySelector<HTMLElement>('#top-card-text-details-contact-info, a[href*="/overlay/contact-info"]');
  if (!link) {
    trace.push('No "Contact info" link on this page');
    return { success: false, contact: null, source: 'none', trace };
  }
  link.click();
  const rendered = await waitFor(renderedContactInfo, 6000);
  await closeOverlay();
  if (!rendered) {
    trace.push('The overlay did not render contact details within 6s');
    return { success: false, contact: null, source: 'modal', trace };
  }
  trace.push('Read the contact-info overlay, then dismissed it');
  return { success: true, contact: rendered, source: 'modal', trace };
}

/** What the panel cares about; a change here is worth pushing. */
function signature(profile: ParsedCandidateProfile | null): string {
  if (!profile) return '';
  return [profile.full_name, profile.current_title, profile.current_company, profile.role_source, profile.location, profile.skills.length].join('|');
}

function init() {
  let alive = true;

  const send = (message: unknown) => {
    if (!alive) return;
    try {
      if (!chrome.runtime?.id) throw new Error('context invalidated');
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      // Extension reloaded in chrome://extensions - this script is orphaned.
      alive = false;
      observer.disconnect();
      window.removeEventListener('popstate', onUrlChange);
    }
  };

  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') {
        sendResponse({ ok: true, version: PROTOCOL_VERSION });
        return false;
      }
      if (message?.type === 'EXTRACT_PROFILE') {
        const result = extractProfile(document, window.location.href);
        lastPushed = signature(result.profile);
        logTrace(`Extracted ${result.profile?.full_name ?? 'nothing'} from ${window.location.pathname}`, result.trace);
        sendResponse({ success: Boolean(result.profile), profile: result.profile, trace: result.trace, version: PROTOCOL_VERSION });
        return false;
      }
      if (message?.type === 'FETCH_CONTACT_INFO') {
        fetchContactInfo()
          .then((result) => {
            logTrace(`Contact info via ${result.source}`, result.trace);
            sendResponse(result);
          })
          .catch((error) =>
            sendResponse({ success: false, contact: null, source: 'none', trace: [String(error)] } satisfies ContactFetchResult),
          );
        return true; // async response
      }
      return false;
    });
  } catch {
    // Extension context invalidated (reloaded in chrome://extensions)
  }

  // LinkedIn renders the profile cards lazily, seconds after the top card,
  // and the Experience rows only when their column decides to. Rather than
  // make the panel poll, watch the DOM and push whenever the extraction
  // result changes - the panel takes the better one.
  let lastUrl = window.location.href;
  let lastPushed = '';
  let pushTimer: number | undefined;

  function pushIfChanged() {
    pushTimer = undefined;
    if (!isLinkedInProfileUrl(window.location.href)) return;
    const result = extractProfile(document, window.location.href);
    const next = signature(result.profile);
    if (!result.profile || next === lastPushed) return;
    lastPushed = next;
    const message: ProfileUpdatedMessage = {
      type: 'PROFILE_UPDATED',
      url: window.location.href,
      version: PROTOCOL_VERSION,
      profile: result.profile,
      trace: result.trace,
    };
    send(message);
  }

  function onUrlChange() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    lastPushed = '';
    send({ type: 'LINKEDIN_PAGE_CHANGED', url: lastUrl });
  }

  const observer = new MutationObserver(() => {
    onUrlChange();
    if (pushTimer === undefined) pushTimer = window.setTimeout(pushIfChanged, 700);
  });

  window.addEventListener('popstate', onUrlChange);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  }
}

// Runs once per protocol version per page. After an extension reload the old
// script is orphaned (its chrome.runtime is dead) but its globals survive in
// the isolated world, so a plain "already loaded" flag would block the fresh
// script the panel injects; keying the flag by version lets it through.
if (window.__prosperityContentVersion !== PROTOCOL_VERSION) {
  window.__prosperityContentVersion = PROTOCOL_VERSION;
  init();
}
