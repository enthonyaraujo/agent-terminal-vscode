import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
  private channel: vscode.OutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel('Agent CLI Terminal');
  }

  private timestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }

  info(message: string): void {
    const line = `[${this.timestamp()}] [INFO] ${message}`;
    console.log(line);
    this.channel.appendLine(line);
  }

  warn(message: string): void {
    const line = `[${this.timestamp()}] [WARN] ${message}`;
    console.warn(line);
    this.channel.appendLine(line);
  }

  error(message: string, error?: any): void {
    const errStr = error ? (error.stack || error.message || String(error)) : '';
    const line = `[${this.timestamp()}] [ERROR] ${message} ${errStr}`;
    console.error(line);
    this.channel.appendLine(line);
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
