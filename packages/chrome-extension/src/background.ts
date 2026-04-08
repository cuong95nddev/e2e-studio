chrome.runtime.onInstalled.addListener(() => {
  console.log('E2E Studio background ready');
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    console.log('E2E Studio received message:', message);
    sendResponse({ ok: true });
    return true;
  }
);
