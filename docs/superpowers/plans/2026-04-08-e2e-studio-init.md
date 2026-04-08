# E2E Studio Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a working npm workspaces monorepo with a VS Code extension and a Chrome extension (MV3), each compiling with TypeScript + esbuild.

**Architecture:** Root `package.json` defines two workspaces (`packages/vscode-extension`, `packages/chrome-extension`). Each package has its own `tsconfig.json` and esbuild build script. No shared packages at this stage.

**Tech Stack:** TypeScript 6.0.2, esbuild 0.28.0, @types/vscode 1.110.0, @types/chrome 0.1.39, npm workspaces

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Root workspace config, shared dev scripts |
| `packages/vscode-extension/package.json` | VS Code extension manifest + build scripts |
| `packages/vscode-extension/tsconfig.json` | TS config for VS Code extension |
| `packages/vscode-extension/src/extension.ts` | Extension entry point (activate/deactivate) |
| `packages/vscode-extension/.vscodeignore` | Files to exclude from VSIX packaging |
| `packages/chrome-extension/package.json` | Chrome extension build scripts |
| `packages/chrome-extension/tsconfig.json` | TS config for Chrome extension |
| `packages/chrome-extension/manifest.json` | Chrome Manifest V3 |
| `packages/chrome-extension/src/background.ts` | Service worker entry point |
| `packages/chrome-extension/src/content.ts` | Content script entry point |

---

## Task 1: Root Workspace

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "e2e-studio",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev": "npm run dev --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
*.vsix
.DS_Store
```

- [ ] **Step 3: Commit**

```bash
git init
git add package.json .gitignore
git commit -m "chore: init monorepo root with npm workspaces"
```

Expected: commit succeeds, `git log --oneline` shows 1 commit.

---

## Task 2: VS Code Extension Scaffold

**Files:**
- Create: `packages/vscode-extension/package.json`
- Create: `packages/vscode-extension/tsconfig.json`
- Create: `packages/vscode-extension/src/extension.ts`
- Create: `packages/vscode-extension/.vscodeignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/vscode-extension/src
```

- [ ] **Step 2: Create packages/vscode-extension/package.json**

```json
{
  "name": "e2e-studio-vscode",
  "displayName": "E2E Studio",
  "description": "Record and manage browser test steps from VS Code",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.110.0"
  },
  "categories": ["Testing"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "e2eStudio.start",
        "title": "E2E Studio: Start Recording"
      }
    ]
  },
  "scripts": {
    "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node",
    "dev": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node --watch"
  },
  "devDependencies": {
    "@types/vscode": "^1.110.0",
    "esbuild": "^0.28.0",
    "typescript": "^6.0.2"
  }
}
```

- [ ] **Step 3: Create packages/vscode-extension/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create packages/vscode-extension/src/extension.ts**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('E2E Studio');
  channel.appendLine('E2E Studio activated');
  channel.show();

  const cmd = vscode.commands.registerCommand('e2eStudio.start', () => {
    vscode.window.showInformationMessage('E2E Studio: Recording started');
  });

  context.subscriptions.push(channel, cmd);
}

export function deactivate(): void {}
```

- [ ] **Step 5: Create packages/vscode-extension/.vscodeignore**

```
src/
node_modules/
tsconfig.json
.vscodeignore
```

- [ ] **Step 6: Install deps and verify build**

```bash
cd packages/vscode-extension
npm install
npm run build
```

Expected: `dist/extension.js` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat: scaffold VS Code extension package"
```

---

## Task 3: Chrome Extension Scaffold

**Files:**
- Create: `packages/chrome-extension/package.json`
- Create: `packages/chrome-extension/tsconfig.json`
- Create: `packages/chrome-extension/manifest.json`
- Create: `packages/chrome-extension/src/background.ts`
- Create: `packages/chrome-extension/src/content.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/chrome-extension/src
```

- [ ] **Step 2: Create packages/chrome-extension/package.json**

```json
{
  "name": "e2e-studio-chrome",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "esbuild src/background.ts --bundle --outfile=dist/background.js --format=esm && esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife",
    "dev": "esbuild src/background.ts --bundle --outfile=dist/background.js --format=esm --watch & esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife --watch"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.39",
    "esbuild": "^0.28.0",
    "typescript": "^6.0.2"
  }
}
```

- [ ] **Step 3: Create packages/chrome-extension/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "DOM"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create packages/chrome-extension/manifest.json**

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
    "default_title": "E2E Studio"
  }
}
```

- [ ] **Step 5: Create packages/chrome-extension/src/background.ts**

```typescript
chrome.runtime.onInstalled.addListener(() => {
  console.log('E2E Studio background ready');
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    console.log('E2E Studio received message:', message);
    sendResponse({ ok: true });
  }
);
```

- [ ] **Step 6: Create packages/chrome-extension/src/content.ts**

```typescript
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
```

- [ ] **Step 7: Install deps and verify build**

```bash
cd packages/chrome-extension
npm install
npm run build
```

Expected: `dist/background.js` and `dist/content.js` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/chrome-extension/
git commit -m "feat: scaffold Chrome extension package (MV3)"
```

---

## Task 4: Root Install and Final Verify

- [ ] **Step 1: Install all workspace deps from root**

```bash
# from repo root (where root package.json is)
npm install
```

Expected: `node_modules/` at root, symlinks in each package resolved.

- [ ] **Step 2: Run root build script**

```bash
npm run build
```

Expected: both packages build without errors.

- [ ] **Step 3: Verify dist outputs exist**

```bash
ls packages/vscode-extension/dist/extension.js
ls packages/chrome-extension/dist/background.js
ls packages/chrome-extension/dist/content.js
```

Expected: all three files present.

- [ ] **Step 4: Final commit**

```bash
git add package-lock.json
git commit -m "chore: add root lockfile after workspace install"
```
