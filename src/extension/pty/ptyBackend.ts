import * as vscode from 'vscode';

export interface IPtyForkOptions {
  cols: number;
  rows: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface IPtyProcess extends vscode.Disposable {
  readonly pid: number;
  onData(listener: (data: string) => void): vscode.Disposable;
  onExit(listener: (e: { exitCode: number }) => void): vscode.Disposable;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface IPtyBackend {
  readonly name: string;
  spawn(file: string, args: string[], options: IPtyForkOptions): IPtyProcess;
}
