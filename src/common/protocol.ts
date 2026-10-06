export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  shell: string;
  isAlive: boolean;
  exitCode?: number;
}

export interface TerminalConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontWeightBold: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  cursorStyle: 'block' | 'line' | 'underline';
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
}

// Messages sent from Webview to Extension Host
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'newSession'; name?: string; command?: string }
  | { type: 'closeSession'; sessionId: string }
  | { type: 'selectSession'; sessionId: string }
  | { type: 'renameSession'; sessionId: string; name: string }
  | { type: 'launchAgent' }
  | { type: 'openLink'; url: string }
  | { type: 'restartSession'; sessionId: string };

// Messages sent from Extension Host to Webview
export type ExtensionToWebviewMessage =
  | {
      type: 'init';
      sessions: SessionInfo[];
      activeSessionId?: string;
      config: TerminalConfig;
    }
  | { type: 'sessionCreated'; session: SessionInfo; activate: boolean }
  | { type: 'sessionClosed'; sessionId: string }
  | { type: 'sessionActivated'; sessionId: string }
  | { type: 'sessionRenamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'sessionExit'; sessionId: string; exitCode: number }
  | { type: 'updateConfig'; config: Partial<TerminalConfig> };
