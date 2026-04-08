const icon    = document.getElementById('icon')!;
const title   = document.getElementById('title')!;
const dot     = document.getElementById('dot')!;
const statusEl = document.getElementById('status')!;
const statusText = document.getElementById('status-text')!;
const countEl = document.getElementById('count')!;
const countNum = document.getElementById('count-num')!;
const btn     = document.getElementById('btn') as HTMLButtonElement;

let isRecording = false;

function render(connected: boolean, recording: boolean, steps: number): void {
  isRecording = recording;

  if (!connected) {
    icon.className = 'icon dim';
    title.className = 'title dim';
    dot.className = 'dot gray';
    statusEl.className = 'status';
    statusText.textContent = 'VS Code not connected';
    countEl.style.display = 'none';
    btn.className = 'btn btn-disabled';
    btn.disabled = true;
    btn.textContent = '▶ Start Recording';
    return;
  }

  icon.className = 'icon';
  title.className = 'title';

  if (recording) {
    dot.className = 'dot red';
    statusEl.className = 'status recording';
    statusText.textContent = 'Recording in progress';
    countEl.style.display = 'block';
    countNum.textContent = String(steps);
    btn.className = 'btn btn-stop';
    btn.disabled = false;
    btn.textContent = '■ Stop Recording';
  } else {
    dot.className = 'dot green';
    statusEl.className = 'status';
    statusText.textContent = 'Connected to VS Code';
    countEl.style.display = 'none';
    btn.className = 'btn btn-primary';
    btn.disabled = false;
    btn.textContent = '▶ Start Recording';
  }
}

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

btn.addEventListener('click', async () => {
  if (isRecording) {
    await chrome.runtime.sendMessage({ type: 'stop-recording' });
  } else {
    await chrome.runtime.sendMessage({ type: 'start-recording', sessionId: randomId() });
  }
  // Re-query state after action
  const state = await chrome.runtime.sendMessage({ type: 'get-state' });
  render(state.connected, state.isRecording, state.stepCounter);
});

// Live step-count updates while popup is open
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'step-count') countNum.textContent = String(msg.count);
  if (msg.type === 'connection-state') {
    chrome.runtime.sendMessage({ type: 'get-state' }).then((state) => {
      render(state.connected, state.isRecording, state.stepCounter);
    });
  }
});

// Initial state
chrome.runtime.sendMessage({ type: 'get-state' }).then((state) => {
  render(state.connected, state.isRecording, state.stepCounter);
});
