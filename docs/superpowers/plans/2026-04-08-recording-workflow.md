# Recording Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full recording workflow — Chrome extension captures browser events + screenshots and streams them over WebSocket to the VS Code extension, which stores data in SQLite and displays sessions in a sidebar and step table panel.

**Architecture:** Chrome `content.ts` captures DOM events and forwards them to `background.ts`, which calls `captureVisibleTab()` and sends each step over a persistent WebSocket connection to `ws://localhost:9901`. The VS Code extension host runs a WebSocket server (`wsServer.ts`) that writes steps to SQLite (`db.ts`), saves screenshots to `./data/screenshots/`, and pushes live updates to two React webviews: a `WebviewView` sidebar listing sessions, and a `WebviewPanel` showing the step table.

**Tech Stack:** TypeScript, React 18, shadcn/ui CSS variables, Tailwind CSS, better-sqlite3, ws, Vite (two-entry webview build), esbuild (extension host), Chrome MV3, VS Code 1.110+, Vitest (tests)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/vscode-extension/package.json` | Modify | Add ws, better-sqlite3, vitest, @electron/rebuild deps; update build scripts |
| `packages/vscode-extension/vite.config.ts` | Modify | Add sidebar entry point → `dist/webview/sidebar.js` |
| `packages/vscode-extension/vitest.config.ts` | Create | Vitest config for Node environment (db/ws tests) |
| `packages/vscode-extension/.vscodeignore` | Modify | Include `node_modules/better-sqlite3` in VSIX |
| `packages/vscode-extension/src/db.ts` | Create | SQLite wrapper (sessions + steps CRUD) |
| `packages/vscode-extension/src/db.test.ts` | Create | Unit tests for db.ts |
| `packages/vscode-extension/src/wsServer.ts` | Create | WebSocket server on :9901, dispatches messages to db + webviews |
| `packages/vscode-extension/src/wsServer.test.ts` | Create | Unit tests for wsServer.ts |
| `packages/vscode-extension/src/sidebarProvider.ts` | Create | WebviewViewProvider — serves sidebar React app, pushes session updates |
| `packages/vscode-extension/src/panelManager.ts` | Create | Manages WebviewPanel lifecycle, loads/streams steps |
| `packages/vscode-extension/src/extension.ts` | Modify | Wire WsServer, SidebarProvider, PanelManager on activate |
| `packages/vscode-extension/src/webview/App.tsx` | Modify | Repurpose as step table panel (replaces placeholder screen) |
| `packages/vscode-extension/src/webview/sidebar/main.tsx` | Create | Sidebar webview entry point |
| `packages/vscode-extension/src/webview/sidebar/App.tsx` | Create | Sidebar React app — session list cards |
| `packages/chrome-extension/manifest.json` | Modify | Add `action.default_popup`, `tabs` permission |
| `packages/chrome-extension/package.json` | Modify | Add popup esbuild entry to build script |
| `packages/chrome-extension/src/content.ts` | Modify | Full event capture: click, right-click, input, navigate, scroll, drag |
| `packages/chrome-extension/src/background.ts` | Modify | WebSocket client, screenshot capture, session state |
| `packages/chrome-extension/popup.html` | Create | Chrome popup HTML shell |
| `packages/chrome-extension/src/popup.ts` | Create | Popup UI logic — 3 states, Start/Stop button |

---

## Task 1: Dependencies and Build Configuration

**Files:**
- Modify: `packages/vscode-extension/package.json`
- Modify: `packages/vscode-extension/vite.config.ts`
- Create: `packages/vscode-extension/vitest.config.ts`
- Modify: `packages/vscode-extension/.vscodeignore`
- Modify: `packages/chrome-extension/package.json`

- [ ] **Step 1: Add deps to vscode-extension package.json**

Replace the `scripts`, `devDependencies`, and `dependencies` sections in `packages/vscode-extension/package.json`:

```json
{
  "name": "e2e-studio-vscode",
  "displayName": "E2E Studio",
  "description": "Record and manage browser test steps from VS Code",
  "version": "0.1.0",
  "publisher": "e2e-studio",
  "engines": { "vscode": "^1.110.0" },
  "icon": "assets/logo.png",
  "categories": ["Testing"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "e2eStudio.start", "title": "E2E Studio: Start Recording" },
      { "command": "e2eStudio.openPanel", "title": "E2E Studio: Open" }
    ],
    "viewsContainers": {
      "activitybar": [
        { "id": "e2eStudio", "title": "E2E Studio", "icon": "assets/icon.svg" }
      ]
    },
    "views": {
      "e2eStudio": [
        { "id": "e2eStudio.sidebar", "name": "Recordings", "type": "webview" }
      ]
    }
  },
  "scripts": {
    "build": "npm run build:ext && npm run build:webview",
    "build:ext": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --external:better-sqlite3 --format=cjs --platform=node",
    "build:webview": "vite build",
    "dev": "concurrently --kill-others-on-fail \"npm run dev:ext\" \"npm run dev:webview\"",
    "dev:ext": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --external:better-sqlite3 --format=cjs --platform=node --watch",
    "dev:webview": "vite build --watch",
    "test": "vitest run",
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.1",
    "@types/better-sqlite3": "^7.6.13",
    "@types/react": "^18.3.28",
    "@types/react-dom": "^18.3.7",
    "@types/vscode": "^1.110.0",
    "@types/ws": "^8.5.14",
    "@vitejs/plugin-react": "^6.0.1",
    "autoprefixer": "^10.4.27",
    "concurrently": "^9.2.1",
    "esbuild": "^0.28.0",
    "postcss": "^8.5.9",
    "tailwindcss": "^3.4.19",
    "typescript": "^6.0.2",
    "vite": "^8.0.7",
    "vitest": "^3.1.1"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.4",
    "better-sqlite3": "^11.9.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.5.0",
    "ws": "^8.18.2"
  }
}
```

Key changes from the old file:
- View `e2eStudio.mainView` renamed to `e2eStudio.sidebar` with `"type": "webview"` (replaces the tree view welcome)
- Removed `viewsWelcome` section
- `build:ext` adds `--external:better-sqlite3`
- Added `test`, `rebuild` scripts
- Added new deps

- [ ] **Step 2: Update vite.config.ts for two entry points**

Replace `packages/vscode-extension/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: 'src/webview/main.tsx',
        sidebar: 'src/webview/sidebar/main.tsx',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-chunk.js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/webview'),
    },
  },
});
```

- [ ] **Step 3: Create vitest.config.ts**

Create `packages/vscode-extension/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Update .vscodeignore to include better-sqlite3**

Replace `packages/vscode-extension/.vscodeignore`:

```
src/
node_modules/**
!node_modules/better-sqlite3/**
tsconfig.json
vite.config.ts
vitest.config.ts
tailwind.config.ts
postcss.config.js
components.json
.vscodeignore
```

- [ ] **Step 5: Add popup entry to chrome-extension build**

Replace `packages/chrome-extension/package.json`:

```json
{
  "name": "e2e-studio-chrome",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "esbuild src/background.ts --bundle --outfile=dist/background.js --format=esm && esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife && esbuild src/popup.ts --bundle --outfile=dist/popup.js --format=iife",
    "dev": "concurrently \"esbuild src/background.ts --bundle --outfile=dist/background.js --format=esm --watch\" \"esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife --watch\" \"esbuild src/popup.ts --bundle --outfile=dist/popup.js --format=iife --watch\""
  },
  "devDependencies": {
    "@types/chrome": "^0.1.39",
    "concurrently": "^9.2.1",
    "esbuild": "^0.28.0",
    "typescript": "^6.0.2"
  }
}
```

- [ ] **Step 6: Install deps**

```bash
cd "/Users/cuongpham/ws/e2e studio"
npm install
```

Expected: no errors. `better-sqlite3` downloads a prebuilt binary for your platform.

- [ ] **Step 7: Verify build still works**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm run build:ext
```

Expected: `dist/extension.js` created, no errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/package.json packages/vscode-extension/vite.config.ts packages/vscode-extension/vitest.config.ts packages/vscode-extension/.vscodeignore packages/chrome-extension/package.json package-lock.json
git commit -m "chore: add ws, better-sqlite3, vitest deps; two-entry vite build; popup build entry"
```

---

## Task 2: SQLite Database Layer (db.ts)

**Files:**
- Create: `packages/vscode-extension/src/db.ts`
- Create: `packages/vscode-extension/src/db.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/vscode-extension/src/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Db } from './db';

let tmpDir: string;
let db: Db;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-studio-test-'));
  db = new Db(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Db', () => {
  it('createSession returns session with sequential name', () => {
    const s1 = db.createSession('id-1');
    const s2 = db.createSession('id-2');
    expect(s1.name).toBe('Session #1');
    expect(s2.name).toBe('Session #2');
    expect(s1.id).toBe('id-1');
    expect(s1.step_count).toBe(0);
  });

  it('getSessions returns all sessions newest first', () => {
    db.createSession('id-1');
    db.createSession('id-2');
    const sessions = db.getSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('id-2');
  });

  it('insertStep increments session step_count', () => {
    db.createSession('sess-1');
    db.insertStep({
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click on "Login"',
      xpath: '//button[1]',
      screenshotBase64: null,
      timestamp: Date.now(),
    });
    const sessions = db.getSessions();
    expect(sessions[0].step_count).toBe(1);
  });

  it('insertStep saves screenshot file when base64 provided', () => {
    db.createSession('sess-1');
    // 1x1 transparent PNG base64
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const step = db.insertStep({
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click',
      xpath: null,
      screenshotBase64: png1x1,
      timestamp: Date.now(),
    });
    expect(step.screenshot_path).toMatch(/sess-1/);
    expect(fs.existsSync(path.join(tmpDir, 'screenshots', 'sess-1', '1.png'))).toBe(true);
  });

  it('getSteps returns steps in order for a session', () => {
    db.createSession('sess-1');
    db.insertStep({ sessionId: 'sess-1', stepNumber: 1, actionType: 'click', description: 'Step 1', xpath: null, screenshotBase64: null, timestamp: 1 });
    db.insertStep({ sessionId: 'sess-1', stepNumber: 2, actionType: 'input', description: 'Step 2', xpath: null, screenshotBase64: null, timestamp: 2 });
    const steps = db.getSteps('sess-1');
    expect(steps).toHaveLength(2);
    expect(steps[0].step_number).toBe(1);
    expect(steps[1].action_type).toBe('input');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm test
```

Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 3: Implement db.ts**

Create `packages/vscode-extension/src/db.ts`:

```typescript
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

export interface Step {
  id: number;
  session_id: string;
  step_number: number;
  action_type: string;
  description: string;
  xpath: string | null;
  screenshot_path: string | null;
  timestamp: number;
}

export class Db {
  private db: Database.Database;
  private screenshotsDir: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.screenshotsDir = path.join(dataDir, 'screenshots');
    fs.mkdirSync(this.screenshotsDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'e2e-studio.db'));
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        step_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS steps (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(id),
        step_number     INTEGER NOT NULL,
        action_type     TEXT NOT NULL,
        description     TEXT NOT NULL,
        xpath           TEXT,
        screenshot_path TEXT,
        timestamp       INTEGER NOT NULL
      );
    `);
  }

  createSession(id: string): Session {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    const name = `Session #${row.n + 1}`;
    const created_at = Date.now();
    this.db.prepare(
      'INSERT INTO sessions (id, name, created_at, step_count) VALUES (?, ?, ?, 0)'
    ).run(id, name, created_at);
    return { id, name, created_at, step_count: 0 };
  }

  insertStep(params: {
    sessionId: string;
    stepNumber: number;
    actionType: string;
    description: string;
    xpath: string | null;
    screenshotBase64: string | null;
    timestamp: number;
  }): Step {
    let screenshot_path: string | null = null;

    if (params.screenshotBase64) {
      const dir = path.join(this.screenshotsDir, params.sessionId);
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${params.stepNumber}.png`);
      const base64 = params.screenshotBase64.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      screenshot_path = path.join('screenshots', params.sessionId, `${params.stepNumber}.png`);
    }

    const result = this.db.prepare(`
      INSERT INTO steps (session_id, step_number, action_type, description, xpath, screenshot_path, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.sessionId, params.stepNumber, params.actionType,
      params.description, params.xpath, screenshot_path, params.timestamp
    );

    this.db.prepare('UPDATE sessions SET step_count = step_count + 1 WHERE id = ?')
      .run(params.sessionId);

    return {
      id: result.lastInsertRowid as number,
      session_id: params.sessionId,
      step_number: params.stepNumber,
      action_type: params.actionType,
      description: params.description,
      xpath: params.xpath,
      screenshot_path,
      timestamp: params.timestamp,
    };
  }

  finalizeSession(_id: string): void {
    // step_count maintained live by insertStep; nothing extra needed
  }

  getSessions(): Session[] {
    return this.db.prepare(
      'SELECT * FROM sessions ORDER BY created_at DESC'
    ).all() as Session[];
  }

  getSteps(sessionId: string): Step[] {
    return this.db.prepare(
      'SELECT * FROM steps WHERE session_id = ? ORDER BY step_number ASC'
    ).all(sessionId) as Step[];
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm test
```

Expected: 5 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/db.ts packages/vscode-extension/src/db.test.ts
git commit -m "feat: add SQLite database layer (db.ts) with tests"
```

---

## Task 3: WebSocket Server (wsServer.ts)

**Files:**
- Create: `packages/vscode-extension/src/wsServer.ts`
- Create: `packages/vscode-extension/src/wsServer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/vscode-extension/src/wsServer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { WsServer } from './wsServer';
import { Db } from './db';

const TEST_PORT = 19901;

let tmpDir: string;
let db: Db;
let server: WsServer;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-ws-test-'));
  db = new Db(tmpDir);
  server = new WsServer(TEST_PORT, db);
  await server.start();
});

afterEach(async () => {
  await server.stop();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function connect(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
  });
}

function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('WsServer', () => {
  it('creates session on session-start message', async () => {
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'abc-123' });
    await waitMs(50);
    const sessions = db.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('abc-123');
    ws.close();
  });

  it('inserts step on step message', async () => {
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-1' });
    await waitMs(30);
    send(ws, {
      type: 'step',
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click "Login"',
      xpath: '//button[1]',
      screenshotBase64: null,
      timestamp: Date.now(),
    });
    await waitMs(50);
    const steps = db.getSteps('sess-1');
    expect(steps).toHaveLength(1);
    expect(steps[0].description).toBe('Click "Login"');
    ws.close();
  });

  it('fires onSessionChange callback on session-start and session-end', async () => {
    const calls: string[] = [];
    server.onSessionChange = (sessionId) => calls.push(sessionId);
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-cb' });
    await waitMs(30);
    send(ws, { type: 'session-end', sessionId: 'sess-cb' });
    await waitMs(30);
    expect(calls).toEqual(['sess-cb', 'sess-cb']);
    ws.close();
  });

  it('fires onStep callback with step data', async () => {
    const steps: object[] = [];
    server.onStep = (step) => steps.push(step);
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-2' });
    await waitMs(30);
    send(ws, {
      type: 'step',
      sessionId: 'sess-2',
      stepNumber: 1,
      actionType: 'navigate',
      description: 'Navigate to /home',
      xpath: null,
      screenshotBase64: null,
      timestamp: 123,
    });
    await waitMs(50);
    expect(steps).toHaveLength(1);
    ws.close();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm test
```

Expected: FAIL — `Cannot find module './wsServer'`

- [ ] **Step 3: Implement wsServer.ts**

Create `packages/vscode-extension/src/wsServer.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { Db, Session, Step } from './db';

interface SessionStartMsg {
  type: 'session-start';
  sessionId: string;
}

interface StepMsg {
  type: 'step';
  sessionId: string;
  stepNumber: number;
  actionType: string;
  description: string;
  xpath: string | null;
  screenshotBase64: string | null;
  timestamp: number;
}

interface SessionEndMsg {
  type: 'session-end';
  sessionId: string;
}

type IncomingMsg = SessionStartMsg | StepMsg | SessionEndMsg;

export class WsServer {
  private wss: WebSocketServer | null = null;
  onSessionChange: ((sessionId: string) => void) | null = null;
  onStep: ((step: Step) => void) | null = null;

  constructor(private port: number, private db: Db) {}

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });
      this.wss.on('connection', (ws: WebSocket) => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as IncomingMsg;
            this.handle(msg);
          } catch {
            // ignore malformed messages
          }
        });
      });
      this.wss.on('listening', resolve);
    });
  }

  private handle(msg: IncomingMsg): void {
    if (msg.type === 'session-start') {
      this.db.createSession(msg.sessionId);
      this.onSessionChange?.(msg.sessionId);
    } else if (msg.type === 'step') {
      const step = this.db.insertStep({
        sessionId: msg.sessionId,
        stepNumber: msg.stepNumber,
        actionType: msg.actionType,
        description: msg.description,
        xpath: msg.xpath,
        screenshotBase64: msg.screenshotBase64,
        timestamp: msg.timestamp,
      });
      this.onStep?.(step);
    } else if (msg.type === 'session-end') {
      this.db.finalizeSession(msg.sessionId);
      this.onSessionChange?.(msg.sessionId);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) { resolve(); return; }
      this.wss.close(() => resolve());
    });
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm test
```

Expected: 9 tests pass (5 db + 4 wsServer), 0 failures.

- [ ] **Step 5: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/wsServer.ts packages/vscode-extension/src/wsServer.test.ts
git commit -m "feat: add WebSocket server (wsServer.ts) with tests"
```

---

## Task 4: Chrome content.ts — Full Event Capture

**Files:**
- Modify: `packages/chrome-extension/src/content.ts`

- [ ] **Step 1: Implement content.ts**

Replace `packages/chrome-extension/src/content.ts`:

```typescript
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
  const target = e.target as HTMLInputElement;
  if (target.type === 'password') return;
  if (!isRecording) return;
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
```

- [ ] **Step 2: Build chrome extension**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/chrome-extension"
npm run build
```

Expected: `dist/content.js` rebuilt with no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/chrome-extension/src/content.ts
git commit -m "feat: implement full event capture in content.ts (click, input, navigate, scroll, drag)"
```

---

## Task 5: Chrome background.ts — WebSocket Client + Screenshots

**Files:**
- Modify: `packages/chrome-extension/src/background.ts`

- [ ] **Step 1: Implement background.ts**

Replace `packages/chrome-extension/src/background.ts`:

```typescript
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
    ws?.close();
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
    const step = stepCounter;
    const sessionId = currentSessionId;
    // Broadcast updated step count to popup
    chrome.runtime.sendMessage({ type: 'step-count', count: step }).catch(() => {});
    // Capture screenshot then send step
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;
      chrome.tabs.captureVisibleTab(tabs[0].windowId!, { format: 'png' }, (dataUrl) => {
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
```

- [ ] **Step 2: Build**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/chrome-extension"
npm run build
```

Expected: `dist/background.js` rebuilt, no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/chrome-extension/src/background.ts
git commit -m "feat: background.ts — WebSocket client, screenshot capture, session state"
```

---

## Task 6: Chrome Popup

**Files:**
- Create: `packages/chrome-extension/popup.html`
- Create: `packages/chrome-extension/src/popup.ts`

- [ ] **Step 1: Create popup.html**

Create `packages/chrome-extension/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Studio</title>
  <style>
    :root {
      --background: hsl(222.2 84% 4.9%);
      --foreground: hsl(210 40% 98%);
      --card: hsl(222.2 84% 4.9%);
      --muted: hsl(217.2 32.6% 17.5%);
      --muted-foreground: hsl(215 20.2% 65.1%);
      --border: hsl(217.2 32.6% 17.5%);
      --primary: hsl(210 40% 98%);
      --primary-foreground: hsl(222.2 47.4% 11.2%);
      --destructive-bg: hsl(0 62.8% 50%);
      --destructive-fg: hsl(210 40% 98%);
      --radius: 0.5rem;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 220px;
      background: var(--background);
      color: var(--foreground);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      padding: 16px;
    }
    .header {
      display: flex; align-items: center; gap: 10px;
      padding-bottom: 12px; margin-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .icon {
      width: 32px; height: 32px;
      background: var(--primary); color: var(--primary-foreground);
      border-radius: calc(var(--radius) - 2px);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .icon.dim { background: var(--muted); color: var(--muted-foreground); }
    .title { font-size: 14px; font-weight: 600; }
    .title.dim { color: var(--muted-foreground); }
    .status {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-radius: calc(var(--radius) - 2px);
      background: var(--muted); font-size: 12px;
      color: var(--muted-foreground); margin-bottom: 12px;
    }
    .status.recording { background: hsl(0 62.8% 15%); color: hsl(0 72% 65%); }
    .dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .dot.green  { background: hsl(142 71% 45%); }
    .dot.red    { background: hsl(0 72% 51%); animation: pulse 1.2s ease-in-out infinite; }
    .dot.gray   { background: hsl(215 16% 40%); }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.25; } }
    .count { font-size: 12px; color: var(--muted-foreground); text-align: center; margin-bottom: 12px; }
    .count span { font-weight: 600; color: var(--foreground); }
    .btn {
      width: 100%; padding: 8px 14px;
      border-radius: calc(var(--radius) - 2px);
      font-size: 13px; font-weight: 500; border: none; cursor: pointer;
    }
    .btn-primary  { background: var(--primary); color: var(--primary-foreground); }
    .btn-stop     { background: var(--destructive-bg); color: var(--destructive-fg); }
    .btn-disabled { background: var(--muted); color: var(--muted-foreground); cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon" id="icon">🎬</div>
    <div class="title" id="title">E2E Studio</div>
  </div>
  <div class="status" id="status">
    <div class="dot gray" id="dot"></div>
    <span id="status-text">Connecting…</span>
  </div>
  <div class="count" id="count" style="display:none"><span id="count-num">0</span> steps captured</div>
  <button class="btn btn-disabled" id="btn" disabled>▶ Start Recording</button>
  <script src="dist/popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.ts**

Create `packages/chrome-extension/src/popup.ts`:

```typescript
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
```

- [ ] **Step 3: Build**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/chrome-extension"
npm run build
```

Expected: `dist/popup.js` created, no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/chrome-extension/popup.html packages/chrome-extension/src/popup.ts
git commit -m "feat: add Chrome extension popup (3 states: disconnected, idle, recording)"
```

---

## Task 7: Chrome manifest.json Update

**Files:**
- Modify: `packages/chrome-extension/manifest.json`

- [ ] **Step 1: Update manifest**

Replace `packages/chrome-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "E2E Studio",
  "version": "0.1.0",
  "description": "Capture browser test steps for E2E Studio",
  "permissions": [
    "activeTab",
    "scripting",
    "tabs"
  ],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content.js"]
    }
  ],
  "action": {
    "default_title": "E2E Studio",
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Changes: added `"tabs"` permission and `"default_popup": "popup.html"`.

- [ ] **Step 2: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/chrome-extension/manifest.json
git commit -m "feat: add popup and tabs permission to chrome manifest"
```

---

## Task 8: Sidebar React App

**Files:**
- Create: `packages/vscode-extension/src/webview/sidebar/main.tsx`
- Create: `packages/vscode-extension/src/webview/sidebar/App.tsx`

- [ ] **Step 1: Create sidebar/main.tsx**

Create `packages/vscode-extension/src/webview/sidebar/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import SidebarApp from './App';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
);
```

- [ ] **Step 2: Create sidebar/App.tsx**

Create `packages/vscode-extension/src/webview/sidebar/App.tsx`:

```tsx
import { useEffect, useState } from 'react';

const vscode = acquireVsCodeApi();

interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SidebarApp() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'load-sessions') {
        setSessions(msg.sessions);
        setActiveSessionId(msg.activeSessionId ?? null);
      } else if (msg.type === 'session-added') {
        setSessions((prev) => [msg.session, ...prev]);
        setActiveSessionId(msg.session.id);
      } else if (msg.type === 'session-updated') {
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.session.id ? msg.session : s))
        );
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  function openSession(id: string) {
    vscode.postMessage({ command: 'openSession', sessionId: id });
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-4">
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          No recordings yet. Start recording in the Chrome extension.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => openSession(session.id)}
          className={[
            'flex items-start gap-3 px-3 py-2.5 text-left w-full',
            'hover:bg-accent transition-colors',
            activeSessionId === session.id ? 'bg-accent' : '',
          ].join(' ')}
        >
          <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate">{session.name}</span>
              {activeSessionId === session.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 animate-pulse" />
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDate(session.created_at)} · {session.step_count} steps
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build webview to verify sidebar bundle is generated**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm run build:webview
```

Expected: `dist/webview/panel.js` and `dist/webview/sidebar.js` both created, no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/webview/sidebar/
git commit -m "feat: add sidebar React app (session list)"
```

---

## Task 9: Panel React App (App.tsx)

**Files:**
- Modify: `packages/vscode-extension/src/webview/App.tsx`

- [ ] **Step 1: Replace App.tsx with step table panel**

Replace `packages/vscode-extension/src/webview/App.tsx`:

```tsx
import { useEffect, useState } from 'react';

const vscode = acquireVsCodeApi();

interface Step {
  id: number;
  session_id: string;
  step_number: number;
  action_type: string;
  description: string;
  xpath: string | null;
  screenshot_path: string | null;  // original relative path for openScreenshot command
  screenshot_uri: string | null;   // webview URI for <img> src (set by panelManager)
  timestamp: number;
}

interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

const ACTION_LABELS: Record<string, string> = {
  click: 'click',
  'right-click': 'right-click',
  input: 'input',
  navigate: 'navigate',
  scroll: 'scroll',
  drag: 'drag',
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'load-session') {
        setSession(msg.session);
        setSteps(msg.steps);
        setIsRecording(msg.isRecording ?? false);
      } else if (msg.type === 'step-added') {
        setSteps((prev) => [...prev, msg.step]);
        setSession((prev) => prev ? { ...prev, step_count: prev.step_count + 1 } : prev);
      } else if (msg.type === 'recording-stopped') {
        setIsRecording(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-sm text-muted-foreground">Select a recording from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted flex-shrink-0">
        <span className="text-sm font-medium">{session.name}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-border bg-card text-muted-foreground">
          {session.step_count} steps
        </span>
        {isRecording && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive border border-destructive/20">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            Recording
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-10">#</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border">Step</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-24">Action</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border">XPath</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-20">Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                <td className="px-3 py-2 text-muted-foreground">{step.step_number}</td>
                <td className="px-3 py-2">{step.description}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex px-1.5 py-0.5 rounded-full border border-border bg-card text-muted-foreground text-[10px]">
                    {ACTION_LABELS[step.action_type] ?? step.action_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono truncate max-w-xs">
                  {step.xpath ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {step.screenshot_uri ? (
                    <img
                      src={step.screenshot_uri}
                      alt={`step ${step.step_number}`}
                      className="w-9 h-6 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                      onClick={() => vscode.postMessage({ command: 'openScreenshot', path: step.screenshot_path })}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build webview**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm run build:webview
```

Expected: builds without error. Both `dist/webview/panel.js` and `dist/webview/sidebar.js` present.

- [ ] **Step 3: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/webview/App.tsx
git commit -m "feat: repurpose App.tsx as step table panel"
```

---

## Task 10: Sidebar Provider (sidebarProvider.ts)

**Files:**
- Create: `packages/vscode-extension/src/sidebarProvider.ts`

- [ ] **Step 1: Create sidebarProvider.ts**

Create `packages/vscode-extension/src/sidebarProvider.ts`:

```typescript
import * as vscode from 'vscode';
import { Db, Session } from './db';

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activeSessionId: string | null = null;
  onOpenSession: ((sessionId: string) => void) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly db: Db,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'ready') {
        this.pushSessions();
      } else if (msg.command === 'openSession') {
        this.onOpenSession?.(msg.sessionId);
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'sidebar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.css')
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  pushSessions(): void {
    if (!this.view) return;
    const sessions = this.db.getSessions();
    this.view.webview.postMessage({
      type: 'load-sessions',
      sessions,
      activeSessionId: this.activeSessionId,
    });
  }

  notifySessionAdded(session: Session): void {
    this.activeSessionId = session.id;
    this.view?.webview.postMessage({ type: 'session-added', session });
  }

  notifySessionUpdated(session: Session): void {
    this.view?.webview.postMessage({ type: 'session-updated', session });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/sidebarProvider.ts
git commit -m "feat: add SidebarProvider (WebviewViewProvider)"
```

---

## Task 11: Panel Manager (panelManager.ts)

**Files:**
- Create: `packages/vscode-extension/src/panelManager.ts`

- [ ] **Step 1: Create panelManager.ts**

Create `packages/vscode-extension/src/panelManager.ts`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { Db, Step } from './db';

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentSessionId: string | null = null;
  private isRecording = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly db: Db,
    private readonly workspaceRoot: string,
  ) {}

  open(sessionId: string, recording = false): void {
    this.currentSessionId = sessionId;
    this.isRecording = recording;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'e2eStudio',
        'E2E Studio',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
            vscode.Uri.file(path.join(this.workspaceRoot, 'data', 'screenshots')),
          ],
        }
      );
      this.panel.webview.html = this.getHtml(this.panel.webview);
      this.panel.onDidDispose(() => { this.panel = undefined; });

      this.panel.webview.onDidReceiveMessage((msg) => {
        if (msg.command === 'openScreenshot' && msg.path) {
          const absPath = path.join(this.workspaceRoot, 'data', msg.path);
          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absPath));
        }
      });
    }

    const session = this.db.getSessions().find((s) => s.id === sessionId);
    if (!session) return;
    const steps = this.db.getSteps(sessionId).map((s) => this.toWebviewStep(s));
    this.panel.webview.postMessage({
      type: 'load-session',
      session,
      steps,
      isRecording: recording,
    });
  }

  private toWebviewStep(step: Step): Step & { screenshot_uri: string | null } {
    const screenshot_uri = step.screenshot_path
      ? this.panel!.webview.asWebviewUri(
          vscode.Uri.file(path.join(this.workspaceRoot, 'data', step.screenshot_path))
        ).toString()
      : null;
    return { ...step, screenshot_uri };
  }

  pushStep(step: Step): void {
    if (!this.panel || step.session_id !== this.currentSessionId) return;
    this.panel.webview.postMessage({ type: 'step-added', step: this.toWebviewStep(step) });
  }

  stopRecording(): void {
    this.isRecording = false;
    this.panel?.webview.postMessage({ type: 'recording-stopped' });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'panel.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.css')
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/panelManager.ts
git commit -m "feat: add PanelManager (WebviewPanel lifecycle + live step streaming)"
```

---

## Task 12: Wire Everything in extension.ts

**Files:**
- Modify: `packages/vscode-extension/src/extension.ts`

- [ ] **Step 1: Replace extension.ts**

Replace `packages/vscode-extension/src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { Db } from './db';
import { WsServer } from './wsServer';
import { SidebarProvider } from './sidebarProvider';
import { PanelManager } from './panelManager';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('E2E Studio: open a workspace folder first.');
    return;
  }

  const dataDir = path.join(workspaceRoot, 'data');
  const db = new Db(dataDir);
  const wsServer = new WsServer(9901, db);
  const sidebarProvider = new SidebarProvider(context.extensionUri, db);
  const panelManager = new PanelManager(context.extensionUri, db, workspaceRoot);

  // Wire callbacks
  wsServer.onSessionChange = (sessionId) => {
    const sessions = db.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    // Determine if this is a new session (just added) or an update (ended)
    if (session.step_count === 0) {
      sidebarProvider.notifySessionAdded(session);
      panelManager.open(sessionId, true);
    } else {
      sidebarProvider.notifySessionUpdated(session);
      panelManager.stopRecording();
    }
  };

  wsServer.onStep = (step) => {
    // Refresh the session in the sidebar with updated step_count
    const sessions = db.getSessions();
    const session = sessions.find((s) => s.id === step.session_id);
    if (session) sidebarProvider.notifySessionUpdated(session);
    panelManager.pushStep(step);
  };

  sidebarProvider.onOpenSession = (sessionId) => {
    panelManager.open(sessionId, false);
  };

  // Start WS server
  wsServer.start().catch((err) => {
    vscode.window.showErrorMessage(`E2E Studio: failed to start server — ${err.message}`);
  });

  // Register sidebar provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('e2eStudio.sidebar', sidebarProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('e2eStudio.start', () => {
      sidebarProvider.pushSessions();
    }),
    vscode.commands.registerCommand('e2eStudio.openPanel', () => {
      const sessions = db.getSessions();
      if (sessions.length > 0) panelManager.open(sessions[0].id);
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      wsServer.stop();
      db.close();
    },
  });
}

export function deactivate(): void {}
```

- [ ] **Step 2: Build extension**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm run build
```

Expected: `dist/extension.js`, `dist/webview/panel.js`, `dist/webview/sidebar.js`, `dist/webview/index.css` all present. No TypeScript errors.

- [ ] **Step 3: Verify onSessionChange logic**

The `onSessionChange` is called on both `session-start` and `session-end`. On `session-start`, `step_count` is 0 (newly created), so it calls `notifySessionAdded` + `panelManager.open(..., true)`. On `session-end`, `step_count > 0`, so it calls `notifySessionUpdated` + `panelManager.stopRecording()`. This is correct as long as a session always has at least one step before it ends. If a session ends with 0 steps (user stopped immediately), `stopRecording` is never called. Fix this by tracking open sessions explicitly:

Update the `wsServer.onSessionChange` block in extension.ts:

```typescript
  const openSessions = new Set<string>();

  wsServer.onSessionChange = (sessionId) => {
    const sessions = db.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (!openSessions.has(sessionId)) {
      // session-start
      openSessions.add(sessionId);
      sidebarProvider.notifySessionAdded(session);
      panelManager.open(sessionId, true);
    } else {
      // session-end
      openSessions.delete(sessionId);
      sidebarProvider.notifySessionUpdated(session);
      panelManager.stopRecording();
    }
  };
```

Apply this change to `packages/vscode-extension/src/extension.ts` — add `const openSessions = new Set<string>();` before the `wsServer.onSessionChange` assignment, and update the body as shown.

- [ ] **Step 4: Rebuild**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm run build
```

Expected: builds cleanly.

- [ ] **Step 5: Update .gitignore to exclude data/ and .superpowers/**

Append to the root `.gitignore`:

```
data/
.superpowers/
```

- [ ] **Step 6: Run all tests one final time**

```bash
cd "/Users/cuongpham/ws/e2e studio/packages/vscode-extension"
npm test
```

Expected: 9 tests pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
cd "/Users/cuongpham/ws/e2e studio"
git add packages/vscode-extension/src/extension.ts .gitignore
git commit -m "feat: wire WsServer, SidebarProvider, PanelManager in extension.ts"
```

---

## Manual Verification Checklist

After all tasks are complete, verify end-to-end:

1. Open the repo in VS Code. E2E Studio icon appears in the Activity Bar.
2. Sidebar opens and shows "No recordings yet."
3. Load the Chrome extension from `packages/chrome-extension/` in `chrome://extensions` (Developer mode, Load unpacked).
4. Click the E2E Studio toolbar icon — popup shows "Connected to VS Code" with green dot.
5. Click **Start Recording**. Popup switches to "Recording in progress." VS Code sidebar shows "Session #1" with a pulsing dot. Panel opens showing an empty table with "Recording" badge.
6. Click around on any webpage. Rows appear live in the VS Code panel. Each row has action type badge, XPath, and screenshot thumbnail.
7. Click **Stop Recording**. Popup returns to idle. "Recording" badge disappears from panel header.
8. Reload VS Code. Session #1 appears in sidebar. Click it — panel reopens with all steps loaded from SQLite.
9. Verify `./data/e2e-studio.db` exists and `./data/screenshots/` contains PNG files.
