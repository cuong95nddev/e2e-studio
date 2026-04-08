# E2E Studio — Initial Project Design

**Date:** 2026-04-08  
**Status:** Approved

## Overview

A monorepo tool for recording browser test steps. Consists of two packages:
- **VS Code Extension** — UI panel to view, manage, and interact with recorded test steps
- **Chrome Extension** — Captures user events (clicks, inputs, navigation) and screenshots in the browser

## Architecture

```
e2e-studio/                   # npm workspaces monorepo
├── package.json              # root — defines workspaces, shared scripts
├── packages/
│   ├── vscode-extension/     # VS Code extension package
│   └── chrome-extension/     # Chrome extension package (Manifest V3)
```

## Package: vscode-extension

- **Entry:** `src/extension.ts` — activates extension, registers commands
- **Bundle:** esbuild (fast, no config overhead)
- **Key deps:** `@types/vscode`, `esbuild`
- **Scripts:** `build`, `dev` (watch mode)
- **Output:** `dist/extension.js`

## Package: chrome-extension

- **Manifest:** V3 (current standard)
- **Background:** `src/background.ts` — service worker, receives messages from content script
- **Content Script:** `src/content.ts` — injected into pages, captures DOM events
- **Bundle:** esbuild
- **Scripts:** `build`, `dev` (watch mode)
- **Output:** `dist/` directory loaded by Chrome

## Data Flow (initial)

```
Browser page
  └─ content.ts (captures click/input/navigation events)
       └─ chrome.runtime.sendMessage()
            └─ background.ts (service worker, aggregates events)
                 └─ [future: relay to VS Code via WebSocket or file]
VS Code extension
  └─ [future: WebSocket server or file watcher to receive events]
       └─ Webview panel (displays recorded steps)
```

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| Package manager | npm workspaces |
| Bundler | esbuild |
| VS Code API | `@types/vscode` latest |
| Chrome API | `@types/chrome` latest |

## Scope (this init)

Only scaffold — no feature logic. Each package compiles and loads without errors:
- VS Code: extension activates, shows "E2E Studio activated" in output channel
- Chrome: content script and background load, log "E2E Studio ready" to console
