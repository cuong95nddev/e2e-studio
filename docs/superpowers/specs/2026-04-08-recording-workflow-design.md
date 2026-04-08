# E2E Studio — Recording Workflow Design

**Date:** 2026-04-08
**Status:** Approved

---

## Overview

Add a full recording workflow to the existing E2E Studio monorepo. The user clicks **Start Recording** in the Chrome extension popup; the extension captures all browser interactions across every tab (with a screenshot per action) and streams them in real time to the VS Code extension over a local WebSocket. The VS Code extension persists the data to SQLite, displays past sessions in a sidebar, and shows the live step table in an editor panel.

---

## Architecture

```
Chrome Extension (MV3)
  popup.ts          — Start/Stop button, connection status
  content.ts        — Captures events on every page (all tabs)
  background.ts     — Receives events, captures screenshots,
                      maintains WebSocket to ws://localhost:9901

        ── WebSocket (port 9901) ──▶

VS Code Extension Host (Node.js)
  extension.ts      — Activates WS server, registers sidebar + panel
  wsServer.ts       — WebSocket server, parses messages, dispatches
  db.ts             — SQLite via better-sqlite3, ./data/e2e-studio.db
  sidebarProvider.ts — WebviewViewProvider → React sidebar app
  panelManager.ts   — Creates/reuses WebviewPanel → React table app

        ── postMessage API ──▶

React Webviews
  webview/sidebar/App.tsx  — Session list (cards)
  webview/App.tsx          — Step table for selected/live session
```

---

## Chrome Extension

### popup.ts + popup.html

Three states, all using shadcn/ui dark CSS variables:

| State | Status indicator | Button |
|---|---|---|
| Connected (idle) | Green dot · "Connected to VS Code" | ▶ Start Recording (primary) |
| Recording | Red pulsing dot · "Recording in progress" + step counter | ■ Stop Recording (destructive) |
| Disconnected | Gray dot · "VS Code not connected" | Disabled |

On **Start Recording**: generate a `sessionId` (UUID), send `session-start` message over WebSocket, set `chrome.storage.session` flag.  
On **Stop Recording**: send `session-end` message, clear flag.

### content.ts

Injected into all URLs (`<all_urls>`). Listens for:

| Event | Listener | Description captured |
|---|---|---|
| `click` | `mousedown` (left) | Text content / label of target element |
| `right-click` | `contextmenu` | Text content of target element |
| `input` | `input` (debounced 500ms) | Sanitised value (no passwords) |
| `navigate` | `window.navigation` / `popstate` / `hashchange` | New URL |
| `scroll` | `scroll` (throttled 1s) | Direction (up/down) |
| `drag` | `dragstart` + `drop` | Dragged element text, drop target text |

Each event sends a message to `background.ts` via `chrome.runtime.sendMessage`:

```ts
{
  type: 'event',
  actionType: 'click' | 'right-click' | 'input' | 'navigate' | 'scroll' | 'drag',
  description: string,   // human-readable step label
  xpath: string,         // generated from target element
  timestamp: number,
}
```

XPath is generated client-side from the DOM element (shortest unique path).

### background.ts

- On install: attempts WebSocket connection to `ws://localhost:9901`, retries every 3 seconds if not connected.
- On `session-start`: opens new session state, resets step counter.
- On `event` message (while recording):
  1. Increment step counter, post count to popup via `chrome.runtime.sendMessage`.
  2. Call `chrome.tabs.captureVisibleTab()` → base64 PNG.
  3. Send over WebSocket:

```ts
// Chrome → VS Code messages
{ type: 'session-start', sessionId: string }

{ type: 'step', sessionId: string, stepNumber: number,
  actionType: string, description: string, xpath: string,
  screenshotBase64: string }   // data:image/png;base64,...

{ type: 'session-end', sessionId: string }
```

---

## VS Code Extension

### extension.ts

On `activate`:
1. Start `WsServer` on port 9901.
2. Register `SidebarProvider` as a `WebviewViewProvider` for view ID `e2eStudio.sidebar`.
3. Register command `e2eStudio.openPanel` → `PanelManager.open()`.

Contributes to `package.json`:
- Activity Bar view container with E2E Studio icon.
- View `e2eStudio.sidebar` inside that container.

### wsServer.ts

Wraps the `ws` npm package. On each message:
- `session-start` → `db.createSession(sessionId)` → notify `SidebarProvider`.
- `step` → save screenshot file → `db.insertStep(...)` → push step to `PanelManager` if panel open.
- `session-end` → `db.finalizeSession(sessionId)` → notify `SidebarProvider`.

### db.ts

Uses `better-sqlite3` (requires `electron-rebuild` targeting VS Code's Electron version in the build script).

Database location: `<workspace root>/data/e2e-studio.db` (creates `data/` if absent).

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,   -- "Session #N"
  created_at  INTEGER NOT NULL,
  step_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS steps (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT NOT NULL REFERENCES sessions(id),
  step_number      INTEGER NOT NULL,
  action_type      TEXT NOT NULL,
  description      TEXT NOT NULL,
  xpath            TEXT,
  screenshot_path  TEXT,   -- relative: data/screenshots/<sessionId>/<n>.png
  timestamp        INTEGER NOT NULL
);
```

Screenshot files written to `<workspace>/data/screenshots/<sessionId>/<stepNumber>.png`.

### sidebarProvider.ts

Implements `vscode.WebviewViewProvider`. On `resolveWebviewView`:
- Serves the compiled `dist/webview/sidebar.js` bundle.
- Sends the full session list on load.
- Pushes `{ type: 'session-added' | 'session-updated', session }` when sessions change.
- On message `{ command: 'openSession', sessionId }` from sidebar → `PanelManager.open(sessionId)`.

### panelManager.ts

- Keeps a single `WebviewPanel` instance (reveals if already open).
- On `open(sessionId)`: loads all steps from DB, sends `{ type: 'load-session', session, steps }` to panel webview.
- During live recording: receives steps from `WsServer` and forwards `{ type: 'step-added', step }` to the open panel.
- `localResourceRoots` includes both `dist/webview/` and `<workspace>/data/screenshots/` so screenshot thumbnails can be rendered inside the webview via `webview.asWebviewUri()`.

---

## React Webviews

Both webviews share the existing Tailwind + shadcn/ui setup in `src/webview/`. Dark CSS variables follow shadcn/ui `dark` theme; VS Code webviews inherit from the existing `index.css` mapping to VS Code theme tokens.

The vite/esbuild config gains **two entry points**: `src/webview/main.tsx` → `dist/webview/index.js` (panel) and `src/webview/sidebar/main.tsx` → `dist/webview/sidebar.js` (sidebar). Both share the same `index.css`.

### Sidebar — `src/webview/sidebar/App.tsx`

- Session list, newest first.
- Each session shows: name (Session #N), date, step count.
- Active/recording session shows a pulsing red dot.
- Click → posts `openSession` message to extension host.

### Panel — `src/webview/App.tsx` (repurposed)

Table with columns: **#, Step, Action, XPath, Screenshot**.

- Action column: small outline badge (`click`, `input`, `navigate`, `scroll`, `drag`, `right-click`).
- Screenshot column: 36×24 thumbnail; clicking opens the full image in a VS Code `vscode.open` webview URI.
- During live recording: new rows append at the bottom in real time.
- Header shows session name, step count badge, and "● Recording" badge when live.

---

## File Changes

### New files

| File | Purpose |
|---|---|
| `packages/chrome-extension/popup.html` | Popup HTML shell |
| `packages/chrome-extension/src/popup.ts` | Popup logic |
| `packages/vscode-extension/src/wsServer.ts` | WebSocket server |
| `packages/vscode-extension/src/db.ts` | SQLite wrapper |
| `packages/vscode-extension/src/sidebarProvider.ts` | Sidebar WebviewViewProvider |
| `packages/vscode-extension/src/panelManager.ts` | Panel lifecycle |
| `packages/vscode-extension/src/webview/sidebar/App.tsx` | Sidebar React app |

### Modified files

| File | Change |
|---|---|
| `packages/chrome-extension/manifest.json` | Add `action.default_popup`, add `tabs` permission |
| `packages/chrome-extension/src/content.ts` | Full event capture implementation |
| `packages/chrome-extension/src/background.ts` | WebSocket client + screenshot capture |
| `packages/vscode-extension/package.json` | Add sidebar view contribution, `ws` + `better-sqlite3` deps |
| `packages/vscode-extension/src/extension.ts` | Wire up WsServer, SidebarProvider, PanelManager |
| `packages/vscode-extension/src/webview/App.tsx` | Repurpose as step table panel |

---

## Data Storage Layout

```
<workspace>/
  data/
    e2e-studio.db                          ← SQLite database
    screenshots/
      <sessionId>/
        1.png
        2.png
        ...
```

---

## Dependencies Added

| Package | Where | Notes |
|---|---|---|
| `ws` | vscode-extension | WebSocket server |
| `@types/ws` | vscode-extension | Types only |
| `better-sqlite3` | vscode-extension | Requires electron-rebuild in build |
| `@types/better-sqlite3` | vscode-extension | Types only |

The `chrome-extension` build script gains a `popup` entry point alongside the existing `background` and `content` entries.

---

## Key Constraints

- **Port 9901 is fixed.** No configuration needed in this version.
- **Session naming.** Sessions are named "Session #N" where N is the total count of sessions in the DB at creation time + 1. Stored as a `name` column in the `sessions` table.
- **Passwords excluded.** The content script skips `input[type=password]` fields.
- **One active recording at a time.** The popup disables Start if a session is already active (tracked via `chrome.storage.session`).
- **`better-sqlite3` native binding** must be built against VS Code's Electron version. Build script adds `electron-rebuild` step.
- **`.superpowers/` and `data/` added to `.gitignore`.**
