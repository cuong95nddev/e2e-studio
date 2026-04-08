const WS_URL = 'ws://localhost:9901';
const RETRY_MS = 3000;

let ws: WebSocket | null = null;
let isRecording = false;
let currentSessionId: string | null = null;
let stepCounter = 0;

function connect(): void {
  ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    broadcastConnectionState(true);
  });

  ws.addEventListener('close', () => {
    ws = null;
    broadcastConnectionState(false);
    setTimeout(connect, RETRY_MS);
  });

  ws.addEventListener('error', () => {
    // close event will follow automatically
  });
}

function broadcastConnectionState(connected: boolean): void {
  chrome.runtime.sendMessage({ type: 'connection-state', connected }).catch(() => {});
}

function send(msg: object): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Popup commands
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'start-recording') {
    currentSessionId = msg.sessionId;
    stepCounter = 0;
    isRecording = true;
    send({ type: 'session-start', sessionId: currentSessionId });
    // Tell all content scripts to start
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'recording-state', recording: true }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'stop-recording') {
    isRecording = false;
    send({ type: 'session-end', sessionId: currentSessionId });
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'recording-state', recording: false }).catch(() => {});
      }
    });
    currentSessionId = null;
    sendResponse({ ok: true });
  } else if (msg.type === 'get-state') {
    sendResponse({
      connected: ws?.readyState === WebSocket.OPEN,
      isRecording,
      stepCounter,
    });
  } else if (msg.type === 'event' && isRecording && currentSessionId) {
    stepCounter++;
    sendResponse({ ok: true });
    const step = stepCounter;
    const sessionId = currentSessionId;
    // Broadcast updated step count to popup
    chrome.runtime.sendMessage({ type: 'step-count', count: step }).catch(() => {});
    // Capture screenshot then send step
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      const windowId = tabs[0]?.windowId;
      if (!tabId || !windowId) {
        send({
          type: 'step',
          sessionId,
          stepNumber: step,
          actionType: msg.actionType,
          description: msg.description,
          xpath: msg.xpath ?? null,
          screenshotBase64: null,
          timestamp: Date.now(),
        });
        return;
      }
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          // Send step without screenshot if capture fails
          send({
            type: 'step',
            sessionId,
            stepNumber: step,
            actionType: msg.actionType,
            description: msg.description,
            xpath: msg.xpath ?? null,
            screenshotBase64: null,
            timestamp: Date.now(),
          });
          return;
        }
        send({
          type: 'step',
          sessionId,
          stepNumber: step,
          actionType: msg.actionType,
          description: msg.description,
          xpath: msg.xpath ?? null,
          screenshotBase64: dataUrl,
          timestamp: Date.now(),
        });
      });
    });
  }
  return true;
});

connect();
