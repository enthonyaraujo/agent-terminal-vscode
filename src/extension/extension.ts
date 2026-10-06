import * as vscode from 'vscode';
import { getPtyBackend } from './pty/getPtyBackend';
import { SessionManager } from './sessionManager';
import { TerminalViewProvider } from './terminalViewProvider';
import { Logger } from './logger';

let sessionManager: SessionManager | undefined;
let logger: Logger | undefined;

export function activate(context: vscode.ExtensionContext) {
  logger = new Logger();
  context.subscriptions.push(logger);

  const ptyBackend = getPtyBackend(context.extensionUri, logger);
  sessionManager = new SessionManager(ptyBackend, logger);
  context.subscriptions.push(sessionManager);

  const viewProvider = new TerminalViewProvider(context.extensionUri, sessionManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TerminalViewProvider.viewType,
      viewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Command: Show Log
  context.subscriptions.push(
    vscode.commands.registerCommand('agentCliTerminal.showLog', () => {
      logger?.show();
    })
  );

  // Command: Focus Terminal
  context.subscriptions.push(
    vscode.commands.registerCommand('agentCliTerminal.focus', () => {
      viewProvider.focus();
    })
  );

  // Command: New Terminal
  context.subscriptions.push(
    vscode.commands.registerCommand('agentCliTerminal.newTerminal', () => {
      sessionManager?.createSession();
      viewProvider.focus();
    })
  );

  // Command: Kill Terminal
  context.subscriptions.push(
    vscode.commands.registerCommand('agentCliTerminal.killTerminal', () => {
      const activeId = sessionManager?.activeSessionId;
      if (sessionManager && activeId) {
        sessionManager.closeSession(activeId);
      }
    })
  );

  // Command: Launch Agent
  context.subscriptions.push(
    vscode.commands.registerCommand('agentCliTerminal.launchAgent', async () => {
      const config = vscode.workspace.getConfiguration('agentCliTerminal');
      const agents = config.get<Array<{ name: string; command: string }>>('agents') || [
        { name: 'Claude Code', command: 'claude' },
        { name: 'Codex CLI', command: 'codex' },
        { name: 'Gemini CLI', command: 'gemini' },
      ];

      type AgentQuickPickItem = vscode.QuickPickItem & { command?: string; isCustom?: boolean };

      const items: AgentQuickPickItem[] = agents.map((agent) => ({
        label: `$(sparkle) ${agent.name}`,
        description: agent.command,
        command: agent.command,
      }));

      items.push({
        label: '$(edit) Custom Command...',
        description: 'Run any custom CLI tool',
        isCustom: true,
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an AI Agent or CLI command to launch in Agent CLI Terminal',
        title: 'Launch Agent',
      });

      if (!selected) return;

      let cmd = selected.command;
      let agentName = selected.label.replace('$(sparkle) ', '');

      if (selected.isCustom) {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter command to run',
          placeHolder: 'e.g. claude, codex, agy, ollama run llama3',
        });
        if (!input || !input.trim()) return;
        cmd = input.trim();
        agentName = cmd.split(' ')[0];
      }

      if (!cmd) return;

      // Ask whether to run in new tab or current tab
      const currentSession = sessionManager?.activeSession;
      let targetOption = 'New Tab';

      if (currentSession && currentSession.isAlive) {
        const choice = await vscode.window.showQuickPick(
          [
            { label: 'New Tab', description: `Open a new tab named "${agentName}"` },
            { label: 'Active Tab', description: `Run in "${currentSession.name}"` },
          ],
          { placeHolder: `Where do you want to run "${cmd}"?` }
        );
        if (!choice) return;
        targetOption = choice.label;
      }

      viewProvider.focus();

      if (targetOption === 'New Tab') {
        sessionManager?.createSession({
          name: agentName,
          command: cmd,
          activate: true,
        });
      } else if (currentSession) {
        sessionManager?.renameSession(currentSession.id, agentName);
        sessionManager?.writeToSession(currentSession.id, `${cmd}\n`);
      }
    })
  );
}

export function deactivate() {
  if (sessionManager) {
    sessionManager.dispose();
    sessionManager = undefined;
  }
}
