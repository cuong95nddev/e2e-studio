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
