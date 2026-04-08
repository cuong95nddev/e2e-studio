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

  clearActiveSession(): void {
    this.activeSessionId = null;
    this.pushSessions();
  }
}
