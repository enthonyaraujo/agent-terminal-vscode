import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export interface ResolvedShellConfig {
  shell: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export function resolveShellConfig(overrideCwd?: string): ResolvedShellConfig {
  const platform = process.platform;
  const platformKey = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'osx' : 'linux';

  const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
  const defaultProfileName = terminalConfig.get<string>(`defaultProfile.${platformKey}`);
  const profiles = terminalConfig.get<Record<string, any>>(`profiles.${platformKey}`) || {};

  let shell = '';
  let args: string[] = [];

  if (defaultProfileName && profiles[defaultProfileName]) {
    const profile = profiles[defaultProfileName];
    if (typeof profile.path === 'string') {
      shell = profile.path;
    }
    if (Array.isArray(profile.args)) {
      args = [...profile.args];
    }
  }

  // Fallbacks if shell is still empty
  if (!shell) {
    if (platform === 'win32') {
      shell = process.env.COMSPEC || 'powershell.exe';
    } else {
      shell = process.env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
    }
  }

  // Ensure interactive flag (-i) for Unix shells so .bashrc / .zshrc are loaded
  const shellBasename = path.basename(shell).toLowerCase();
  if (
    shellBasename.includes('bash') ||
    shellBasename.includes('zsh') ||
    shellBasename.includes('fish') ||
    shellBasename.includes('ksh')
  ) {
    if (!args.includes('-i')) {
      args.push('-i');
    }
  }

  // Resolve cwd
  let cwd = overrideCwd;
  if (!cwd) {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      cwd = folders[0].uri.fsPath;
    } else {
      cwd = os.homedir();
    }
  }

  // Resolve environment variables
  const env: NodeJS.ProcessEnv = { ...process.env };
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';

  const userEnv = terminalConfig.get<Record<string, string>>(`env.${platformKey}`);
  if (userEnv && typeof userEnv === 'object') {
    for (const [key, value] of Object.entries(userEnv)) {
      if (value !== null && value !== undefined) {
        env[key] = String(value);
      }
    }
  }

  return { shell, args, cwd, env };
}
