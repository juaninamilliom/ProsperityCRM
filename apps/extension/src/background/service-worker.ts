// Prosperity CRM Extension Background Service Worker (Manifest V3)

// 1. Enable Side Panel to open automatically on action toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('[Prosperity CRM] Error setting side panel behavior:', error));

// 2. Listen for tab updates (e.g. navigation between LinkedIn profiles)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/in/')) {
    // Notify side panel that active LinkedIn profile changed
    chrome.runtime.sendMessage({
      type: 'LINKEDIN_PAGE_UPDATED',
      tabId,
      url: tab.url,
    }).catch(() => {
      // Side panel might not be open yet, ignore error
    });
  }
});

// 3. Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      sendResponse(tabs[0] || null);
    });
    return true; // Keep channel open for async response
  }
});
