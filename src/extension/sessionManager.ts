import * as vscode from 'vscode';
import { IPtyBackend, IPtyProcess } from './pty/ptyBackend';
import { resolveShellConfig } from './shellResolver';
import { SessionInfo } from '../common/protocol';

export interface TerminalSession {
  id: string;
  name: string;
  ptyProcess: IPtyProcess;
  cwd: string;
  shell: string;
  isAlive: boolean;
  exitCode?: number;
  buffer: string[];
  disposables: vscode.Disposable[];
}

export class SessionManager implements vscode.Disposable {
  private sessions = new Map<string, TerminalSession>();
  private activeId: string | undefined;
  private sessionCounter = 0;

  private onDidCreateSessionEmitter = new vscode.EventEmitter<{ session: SessionInfo; activate: boolean }>();
  readonly onDidCreateSession = this.onDidCreateSessionEmitter.event;

  private onDidCloseSessionEmitter = new vscode.EventEmitter<string>();
  readonly onDidCloseSession = this.onDidCloseSessionEmitter.event;

  private onDidActivateSessionEmitter = new vscode.EventEmitter<string>();
  readonly onDidActivateSession = this.onDidActivateSessionEmitter.event;

  private onDidRenameSessionEmitter = new vscode.EventEmitter<{ id: string; name: string }>();
  readonly onDidRenameSession = this.onDidRenameSessionEmitter.event;

  private onSessionOutputEmitter = new vscode.EventEmitter<{ id: string; data: string }>();
  readonly onSessionOutput = this.onSessionOutputEmitter.event;

  private onSessionExitEmitter = new vscode.EventEmitter<{ id: string; exitCode: number }>();
  readonly onSessionExit = this.onSessionExitEmitter.event;

  constructor(private ptyBackend: IPtyBackend, private logger?: import('./logger').Logger) {}

  get activeSessionId(): string | undefined {
    return this.activeId;
  }

  get activeSession(): TerminalSession | undefined {
    return this.activeId ? this.sessions.get(this.activeId) : undefined;
  }

  getAllSessionsInfo(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      shell: s.shell,
      isAlive: s.isAlive,
      exitCode: s.exitCode,
    }));
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  createSession(options?: {
    name?: string;
    cwd?: string;
    command?: string;
    cols?: number;
    rows?: number;
    activate?: boolean;
  }): TerminalSession {
    this.sessionCounter += 1;
    const id = `terminal-${Date.now()}-${this.sessionCounter}`;
    const name = options?.name || `Terminal ${this.sessionCounter}`;

    const shellConfig = resolveShellConfig(options?.cwd);
    const cols = options?.cols || 80;
    const rows = options?.rows || 24;

    this.logger?.info(`Criando sessão: "${name}" (cwd: ${shellConfig.cwd}, shell: ${shellConfig.shell})`);

    const ptyProcess = this.ptyBackend.spawn(shellConfig.shell, shellConfig.args, {
      cols,
      rows,
      cwd: shellConfig.cwd,
      env: shellConfig.env,
    });

    const disposables: vscode.Disposable[] = [];

    const session: TerminalSession = {
      id,
      name,
      ptyProcess,
      cwd: shellConfig.cwd,
      shell: shellConfig.shell,
      isAlive: true,
      buffer: [],
      disposables,
    };

    disposables.push(
      ptyProcess.onData((data: string) => {
        // Keep a rolling buffer of last 100 chunks for instant reconnect
        if (session.buffer.length > 100) {
          session.buffer.shift();
        }
        session.buffer.push(data);
        this.onSessionOutputEmitter.fire({ id, data });
      })
    );

    disposables.push(
      ptyProcess.onExit((e: { exitCode: number }) => {
        session.isAlive = false;
        session.exitCode = e.exitCode;
        this.logger?.info(`Sessão "${session.name}" encerrada com código de saída ${e.exitCode}`);
        this.onSessionExitEmitter.fire({ id, exitCode: e.exitCode });
      })
    );

    this.sessions.set(id, session);

    const shouldActivate = options?.activate !== false;
    if (shouldActivate || !this.activeId) {
      this.activeId = id;
    }

    const sessionInfo: SessionInfo = {
      id,
      name,
      cwd: session.cwd,
      shell: session.shell,
      isAlive: session.isAlive,
    };

    this.onDidCreateSessionEmitter.fire({ session: sessionInfo, activate: shouldActivate });

    // If an initial command was provided (e.g. from agent launcher), send it
    if (options?.command) {
      setTimeout(() => {
        if (session.isAlive) {
          session.ptyProcess.write(`${options.command}\n`);
        }
      }, 300);
    }

    return session;
  }

  selectSession(id: string): void {
    if (this.sessions.has(id) && this.activeId !== id) {
      this.activeId = id;
      this.onDidActivateSessionEmitter.fire(id);
    }
  }

  renameSession(id: string, newName: string): void {
    const session = this.sessions.get(id);
    if (session && newName.trim()) {
      session.name = newName.trim();
      this.onDidRenameSessionEmitter.fire({ id, name: session.name });
    }
  }

  writeToSession(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session && session.isAlive) {
      session.ptyProcess.write(data);
    }
  }

  resizeSession(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (session && session.isAlive) {
      session.ptyProcess.resize(cols, rows);
    }
  }

  restartSession(id: string): void {
    const oldSession = this.sessions.get(id);
    if (!oldSession) return;

    // Dispose old pty listeners
    for (const d of oldSession.disposables) {
      d.dispose();
    }
    oldSession.ptyProcess.kill();

    // Spawn new pty process
    const shellConfig = resolveShellConfig(oldSession.cwd);
    const newPty = this.ptyBackend.spawn(shellConfig.shell, shellConfig.args, {
      cols: 80,
      rows: 24,
      cwd: shellConfig.cwd,
      env: shellConfig.env,
    });

    oldSession.ptyProcess = newPty;
    oldSession.isAlive = true;
    oldSession.exitCode = undefined;
    oldSession.buffer = [];

    const disposables: vscode.Disposable[] = [];
    disposables.push(
      newPty.onData((data: string) => {
        if (oldSession.buffer.length > 100) {
          oldSession.buffer.shift();
        }
        oldSession.buffer.push(data);
        this.onSessionOutputEmitter.fire({ id, data });
      })
    );
    disposables.push(
      newPty.onExit((e: { exitCode: number }) => {
        oldSession.isAlive = false;
        oldSession.exitCode = e.exitCode;
        this.onSessionExitEmitter.fire({ id, exitCode: e.exitCode });
      })
    );
    oldSession.disposables = disposables;

    this.onDidActivateSessionEmitter.fire(id);
  }

  closeSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    for (const d of session.disposables) {
      d.dispose();
    }
    session.ptyProcess.kill();
    this.sessions.delete(id);

    this.onDidCloseSessionEmitter.fire(id);

    if (this.activeId === id) {
      const remaining = Array.from(this.sessions.keys());
      if (remaining.length > 0) {
        this.selectSession(remaining[remaining.length - 1]);
      } else {
        this.activeId = undefined;
      }
    }
  }

  dispose(): void {
    // Kill all pty processes to prevent any orphan processes
    for (const session of this.sessions.values()) {
      for (const d of session.disposables) {
        d.dispose();
      }
      try {
        session.ptyProcess.kill('SIGTERM');
        setTimeout(() => {
          try {
            session.ptyProcess.kill('SIGKILL');
          } catch {}
        }, 300);
      } catch (err) {
        console.error('[SessionManager] Error killing pty process:', err);
      }
    }
    this.sessions.clear();

    this.onDidCreateSessionEmitter.dispose();
    this.onDidCloseSessionEmitter.dispose();
    this.onDidActivateSessionEmitter.dispose();
    this.onDidRenameSessionEmitter.dispose();
    this.onSessionOutputEmitter.dispose();
    this.onSessionExitEmitter.dispose();
  }
}
