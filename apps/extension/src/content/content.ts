import {
  extractProfile,
  parseContactInfoFromHtml,
  parseContactInfoModal,
  profileSlugFromUrl,
  type ContactInfo,
} from './linkedin-parser';

export type ContactFetchResult = {
  success: boolean;
  contact: ContactInfo | null;
  source: 'modal' | 'overlay-fetch' | 'none';
  trace: string[];
};

declare global {
  interface Window {
    __prosperityContentLoaded?: boolean;
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

/** The overlay renders its sections in one go once the API call returns; a
 *  dialog with sections but no contact rows means the person shares nothing. */
function renderedContactInfo(): ContactInfo | null {
  const info = parseContactInfoModal(document);
  if (!info) return null;
  if (info.email || info.phone || info.websites.length > 0) return info;
  const dialog = document.querySelector('#pv-contact-info')?.closest('[role="dialog"], .artdeco-modal');
  return dialog && dialog.querySelectorAll('section').length > 0 ? info : null;
}

async function closeOverlay() {
  const dismiss = document.querySelector<HTMLElement>(
    '.artdeco-modal button[aria-label="Dismiss"], .artdeco-modal__dismiss, [role="dialog"] button[aria-label="Dismiss"]',
  );
  dismiss?.click();
  await wait(300);
  if (/\/overlay\//.test(window.location.pathname)) window.history.back();
}

/**
 * Contact details live behind the "Contact info" link, not in the profile
 * DOM. Three layers, cheapest first:
 *   1. the overlay is already open - read it
 *   2. fetch the overlay route and read the contact payload embedded in it
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

  const overlayUrl = `${window.location.origin}/in/${encodeURIComponent(slug)}/overlay/contact-info/`;
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

function init() {
  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') {
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === 'EXTRACT_PROFILE') {
        const result = extractProfile(document, window.location.href);
        logTrace(`Extracted ${result.profile?.full_name ?? 'nothing'} from ${window.location.pathname}`, result.trace);
        sendResponse({ success: Boolean(result.profile), profile: result.profile, trace: result.trace });
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

  // Tell the side panel when the SPA navigates to another profile.
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => notifyUrlChange());

  function disconnect() {
    observer.disconnect();
    window.removeEventListener('popstate', notifyUrlChange);
  }

  function notifyUrlChange() {
    if (!chrome.runtime?.id) {
      disconnect();
      return;
    }
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    try {
      chrome.runtime.sendMessage({ type: 'LINKEDIN_PAGE_CHANGED', url: lastUrl }).catch(() => {});
    } catch {
      disconnect();
    }
  }

  window.addEventListener('popstate', notifyUrlChange);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  }
}

// The panel re-injects this file when a tab predates the extension install;
// guard so a second injection does not double the listeners.
if (!window.__prosperityContentLoaded) {
  window.__prosperityContentLoaded = true;
  init();
}
