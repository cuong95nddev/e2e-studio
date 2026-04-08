console.log('E2E Studio content script ready');

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  chrome.runtime.sendMessage({
    type: 'click',
    tag: target.tagName,
    text: target.textContent?.trim().slice(0, 100) ?? '',
    url: window.location.href,
    timestamp: Date.now(),
  });
});
