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
    const session = this.db.getSessions().find((s) => s.id === sessionId);
    if (!session) return;

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

    const steps = this.db.getSteps(sessionId).map((s) => this.toWebviewStep(s, this.panel!.webview));
    this.panel.webview.postMessage({
      type: 'load-session',
      session,
      steps,
      isRecording: recording,
    });
  }

  private toWebviewStep(step: Step, webview: vscode.Webview): Step & { screenshot_uri: string | null } {
    const screenshot_uri = step.screenshot_path
      ? webview.asWebviewUri(
          vscode.Uri.file(path.join(this.workspaceRoot, 'data', step.screenshot_path))
        ).toString()
      : null;
    return { ...step, screenshot_uri };
  }

  pushStep(step: Step): void {
    if (!this.panel || step.session_id !== this.currentSessionId) return;
    this.panel.webview.postMessage({ type: 'step-added', step: this.toWebviewStep(step, this.panel.webview) });
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
