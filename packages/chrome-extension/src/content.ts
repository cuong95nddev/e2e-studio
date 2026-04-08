// Generates the shortest unique XPath for a DOM element
function getXPath(el: Element): string {
  if (el.id) return `//*[@id='${el.id}']`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    const tag = current.tagName.toLowerCase();
    parts.unshift(index > 1 ? `${tag}[${index}]` : tag);
    current = current.parentElement;
    if (current === document.documentElement) { parts.unshift('html'); break; }
  }
  return '/' + parts.join('/');
}

function getLabel(el: Element): string {
  const text = el.textContent?.trim().slice(0, 80) ?? '';
  const placeholder = (el as HTMLInputElement).placeholder ?? '';
  const ariaLabel = el.getAttribute('aria-label') ?? '';
  return ariaLabel || text || placeholder || el.tagName.toLowerCase();
}

let isRecording = false;
let pendingInputEl: HTMLElement | null = null;
let pendingInputTimer: ReturnType<typeof setTimeout> | null = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'recording-state') isRecording = msg.recording;
});

function emit(payload: object): void {
  if (!isRecording) return;
  chrome.runtime.sendMessage({ type: 'event', ...payload });
}

// Click
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const target = e.target as Element;
  emit({
    actionType: 'click',
    description: `Click on "${getLabel(target)}"`,
    xpath: getXPath(target),
  });
}, true);

// Right-click
document.addEventListener('contextmenu', (e) => {
  const target = e.target as Element;
  emit({
    actionType: 'right-click',
    description: `Right click on "${getLabel(target)}"`,
    xpath: getXPath(target),
  });
}, true);

// Input — debounced 500ms, skip password fields
document.addEventListener('input', (e) => {
  if (!isRecording) return;
  const target = e.target as HTMLInputElement;
  if (target.type === 'password') return;
  if (pendingInputTimer) clearTimeout(pendingInputTimer);
  pendingInputEl = target;
  pendingInputTimer = setTimeout(() => {
    if (!pendingInputEl) return;
    emit({
      actionType: 'input',
      description: `Type "${(pendingInputEl as HTMLInputElement).value?.slice(0, 50) ?? ''}" into "${getLabel(pendingInputEl)}"`,
      xpath: getXPath(pendingInputEl),
    });
    pendingInputEl = null;
  }, 500);
}, true);

// Navigation — listen to URL changes
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    emit({ actionType: 'navigate', description: `Navigate to ${location.pathname}`, xpath: null });
  }
});
observer.observe(document, { subtree: true, childList: true });
window.addEventListener('popstate', () => {
  emit({ actionType: 'navigate', description: `Navigate to ${location.pathname}`, xpath: null });
});

// Scroll — throttled 1s
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
document.addEventListener('scroll', () => {
  if (scrollTimer) return;
  scrollTimer = setTimeout(() => {
    emit({ actionType: 'scroll', description: 'Scroll down', xpath: null });
    scrollTimer = null;
  }, 1000);
}, true);

// Drag & drop
let dragSource: Element | null = null;
document.addEventListener('dragstart', (e) => {
  dragSource = e.target as Element;
}, true);
document.addEventListener('drop', (e) => {
  const target = e.target as Element;
  const srcLabel = dragSource ? getLabel(dragSource) : '?';
  emit({
    actionType: 'drag',
    description: `Drag "${srcLabel}" to "${getLabel(target)}"`,
    xpath: dragSource ? getXPath(dragSource) : null,
  });
  dragSource = null;
}, true);
