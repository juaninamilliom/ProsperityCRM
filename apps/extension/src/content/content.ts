import { extractLinkedInProfile } from './linkedin-parser';

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PROFILE') {
    const profile = extractLinkedInProfile();
    sendResponse({ success: Boolean(profile), profile });
  }
  return true;
});

// Notify Side Panel when DOM updates or user navigates
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    chrome.runtime.sendMessage({
      type: 'LINKEDIN_PAGE_CHANGED',
      url: lastUrl,
    }).catch(() => {});
  }
});

observer.observe(document.body, { childList: true, subtree: true });
