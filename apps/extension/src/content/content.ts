import { extractLinkedInProfile } from './linkedin-parser';

// Listen for messages from Side Panel
try {
  if (chrome.runtime?.id) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_PROFILE') {
        const profile = extractLinkedInProfile();
        sendResponse({ success: Boolean(profile), profile });
        return false;
      }
    });
  }
} catch {
  // Context invalidated gracefully
}

// Notify Side Panel when DOM updates or user navigates
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  notifyUrlChange();
});

function notifyUrlChange() {
  // Check if extension context is still active
  if (!chrome.runtime?.id) {
    observer.disconnect();
    window.removeEventListener('popstate', notifyUrlChange);
    return;
  }

  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    try {
      chrome.runtime
        .sendMessage({
          type: 'LINKEDIN_PAGE_CHANGED',
          url: lastUrl,
        })
        .catch(() => {});
    } catch {
      // Extension context invalidated when reloaded in chrome://extensions
      observer.disconnect();
      window.removeEventListener('popstate', notifyUrlChange);
    }
  }
}

window.addEventListener('popstate', notifyUrlChange);

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
