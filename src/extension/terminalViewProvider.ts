import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { SessionManager } from './sessionManager';
import {
  ExtensionToWebviewMessage,
  TerminalConfig,
  WebviewToExtensionMessage,
} from '../common/protocol';

export class TerminalViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agentTerminal.view';
  private webviewView?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionManager: SessionManager
  ) {
    this.registerSessionEvents();
    this.registerConfigListener();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Crucial: Keep context alive when view is hidden/minimized
    // Eliminates flicker and avoids breaking running CLI TUIs
    webviewView.description = 'AI CLI Terminal';

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleWebviewMessage(message);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        vscode.commands.executeCommand('setContext', 'agentTerminalFocus', true);
      } else {
        vscode.commands.executeCommand('setContext', 'agentTerminalFocus', false);
      }
    });
  }

  focus(): void {
    if (this.webviewView) {
      this.webviewView.show?.(true);
    }
  }

  postMessage(message: ExtensionToWebviewMessage): void {
    this.webviewView?.webview.postMessage(message);
  }

  private getTerminalConfig(): TerminalConfig {
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    const agentConfig = vscode.workspace.getConfiguration('agentTerminal');
    return {
      fontFamily: config.get<string>('fontFamily') || '',
      fontSize: config.get<number>('fontSize') || 14,
      lineHeight: config.get<number>('lineHeight') || 1,
      cursorStyle: (config.get<string>('cursorStyle') || 'block') as any,
      cursorBlink: config.get<boolean>('cursorBlink') ?? true,
      scrollback: config.get<number>('scrollback') || 5000,
      copyOnSelect: agentConfig.get<boolean>('copyOnSelect') ?? false,
    };
  }

  private handleWebviewMessage(message: WebviewToExtensionMessage): void {
    switch (message.type) {
      case 'ready': {
        // If no session exists yet, create the initial session
        if (this.sessionManager.getAllSessionsInfo().length === 0) {
          this.sessionManager.createSession();
        }

        const sessions = this.sessionManager.getAllSessionsInfo();
        const activeId = this.sessionManager.activeSessionId;
        const config = this.getTerminalConfig();

        this.postMessage({
          type: 'init',
          sessions,
          activeSessionId: activeId,
          config,
        });

        // Send existing buffered output for each session
        for (const session of sessions) {
          const s = this.sessionManager.getSession(session.id);
          if (s && s.buffer.length > 0) {
            this.postMessage({
              type: 'output',
              sessionId: session.id,
              data: s.buffer.join(''),
            });
          }
        }
        break;
      }

      case 'input': {
        this.sessionManager.writeToSession(message.sessionId, message.data);
        break;
      }

      case 'resize': {
        this.sessionManager.resizeSession(message.sessionId, message.cols, message.rows);
        break;
      }

      case 'newSession': {
        this.sessionManager.createSession({
          name: message.name,
          command: message.command,
        });
        break;
      }

      case 'closeSession': {
        this.sessionManager.closeSession(message.sessionId);
        break;
      }

      case 'selectSession': {
        this.sessionManager.selectSession(message.sessionId);
        break;
      }

      case 'renameSession': {
        this.sessionManager.renameSession(message.sessionId, message.name);
        break;
      }

      case 'launchAgent': {
        vscode.commands.executeCommand('agentTerminal.launchAgent');
        break;
      }

      case 'openLink': {
        try {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        } catch (err) {
          console.error('[AgentTerminal] Failed to open external URL:', err);
        }
        break;
      }

      case 'restartSession': {
        this.sessionManager.restartSession(message.sessionId);
        break;
      }
    }
  }

  private registerSessionEvents(): void {
    this.sessionManager.onDidCreateSession(({ session, activate }) => {
      this.postMessage({ type: 'sessionCreated', session, activate });
    });

    this.sessionManager.onDidCloseSession((sessionId) => {
      this.postMessage({ type: 'sessionClosed', sessionId });
    });

    this.sessionManager.onDidActivateSession((sessionId) => {
      this.postMessage({ type: 'sessionActivated', sessionId });
    });

    this.sessionManager.onDidRenameSession(({ id, name }) => {
      this.postMessage({ type: 'sessionRenamed', sessionId: id, name });
    });

    this.sessionManager.onSessionOutput(({ id, data }) => {
      this.postMessage({ type: 'output', sessionId: id, data });
    });

    this.sessionManager.onSessionExit(({ id, exitCode }) => {
      this.postMessage({ type: 'sessionExit', sessionId: id, exitCode });
    });
  }

  private registerConfigListener(): void {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('terminal.integrated') || e.affectsConfiguration('agentTerminal')) {
        const config = this.getTerminalConfig();
        this.postMessage({ type: 'updateConfig', config });
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
    );

    const nonce = crypto.randomBytes(16).toString('hex');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Agent Terminal</title>
</head>
<body>
  <div id="app">
    <header id="toolbar">
      <div id="tabs" role="tablist"></div>
      <div id="actions">
        <button id="btn-launch-agent" class="icon-button" title="Launch AI Agent (Ctrl+Alt+A)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M7.657 1.343a.5.5 0 0 1 .686 0l1.172 1.172a.5.5 0 0 0 .353.146h1.657a.5.5 0 0 1 .5.5v1.657a.5.5 0 0 0 .146.353l1.172 1.172a.5.5 0 0 1 0 .686l-1.172 1.172a.5.5 0 0 0-.146.353v1.657a.5.5 0 0 1-.5.5h-1.657a.5.5 0 0 0-.353.146l-1.172 1.172a.5.5 0 0 1-.686 0l-1.172-1.172a.5.5 0 0 0-.353-.146H4.47a.5.5 0 0 1-.5-.5v-1.657a.5.5 0 0 0-.146-.353L2.652 8.329a.5.5 0 0 1 0-.686l1.172-1.172a.5.5 0 0 0 .146-.353V4.46a.5.5 0 0 1 .5-.5h1.657a.5.5 0 0 0 .353-.146l1.172-1.172zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
          </svg>
        </button>
        <button id="btn-new-tab" class="icon-button" title="New Terminal (Ctrl+Alt+N)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
          </svg>
        </button>
      </div>
    </header>
    <main id="terminals-container"></main>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
