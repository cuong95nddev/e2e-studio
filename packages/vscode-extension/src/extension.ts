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
      sidebarProvider.clearActiveSession();
      panelManager.stopRecording();
    }
  };

  wsServer.onStep = (step) => {
    const sessions = db.getSessions();
    const session = sessions.find((s) => s.id === step.session_id);
    if (session) sidebarProvider.notifySessionUpdated(session);
    panelManager.pushStep(step);
  };

  sidebarProvider.onOpenSession = (sessionId) => {
    panelManager.open(sessionId, false);
  };

  // Start WS server
  wsServer.start().catch((err: Error) => {
    vscode.window.showErrorMessage(`E2E Studio: failed to start server — ${err.message}`);
    db.close();
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
      wsServer.stop().then(() => db.close()).catch(() => db.close());
    },
  });
}

export function deactivate(): void {}
