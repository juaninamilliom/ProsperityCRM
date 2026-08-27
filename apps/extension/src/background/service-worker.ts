// Prosperity CRM Extension Background Service Worker (Manifest V3)

function isLinkedInUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('linkedin.com/in/') ||
    url.includes('linkedin.com/sales/lead/') ||
    url.includes('linkedin.com/sales/people/') ||
    url.includes('linkedin.com/talent/profile/')
  );
}

// 1. Enable Side Panel to open automatically on action toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('[Prosperity CRM] Error setting side panel behavior:', error));

// 2. Listen for tab updates (URL change, SPA navigation, page reload)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.url;
  if (targetUrl && (changeInfo.url || changeInfo.status === 'complete' || changeInfo.title)) {
    chrome.runtime
      .sendMessage({
        type: 'LINKEDIN_PAGE_UPDATED',
        tabId,
        url: targetUrl,
      })
      .catch(() => {
        // Side panel might not be open, ignore
      });
  }
});

// 3. Listen for tab switches (switching between open tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab?.url) {
      chrome.runtime
        .sendMessage({
          type: 'LINKEDIN_PAGE_UPDATED',
          tabId: activeInfo.tabId,
          url: tab.url,
        })
        .catch(() => {});
    }
  });
});

// 4. Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      sendResponse(tabs[0] || null);
    });
    return true; // Keep channel open for async response
  }
});
