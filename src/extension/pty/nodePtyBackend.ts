import * as vscode from 'vscode';
import { IPtyBackend, IPtyForkOptions, IPtyProcess } from './ptyBackend';

export class NodePtyBackend implements IPtyBackend {
  readonly name = 'node-pty';
  private ptyModule: any;

  constructor() {
    this.ptyModule = require('@homebridge/node-pty-prebuilt-multiarch');
  }

  spawn(file: string, args: string[], options: IPtyForkOptions): IPtyProcess {
    const ptyProcess = this.ptyModule.spawn(file, args, {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd,
      env: options.env as { [key: string]: string },
    });

    const onDataEmitter = new vscode.EventEmitter<string>();
    const onExitEmitter = new vscode.EventEmitter<{ exitCode: number }>();

    const dataListener = ptyProcess.onData((data: string) => {
      onDataEmitter.fire(data);
    });

    const exitListener = ptyProcess.onExit((e: { exitCode: number }) => {
      onExitEmitter.fire(e);
    });

    return {
      pid: ptyProcess.pid,
      onData: onDataEmitter.event,
      onExit: onExitEmitter.event,
      write: (data: string) => {
        try {
          ptyProcess.write(data);
        } catch (err) {
          console.error('[NodePty] write error:', err);
        }
      },
      resize: (cols: number, rows: number) => {
        try {
          ptyProcess.resize(Math.max(1, cols), Math.max(1, rows));
        } catch (err) {
          console.error('[NodePty] resize error:', err);
        }
      },
      kill: (signal?: string) => {
        try {
          ptyProcess.kill(signal);
        } catch (err) {
          console.error('[NodePty] kill error:', err);
        }
      },
      dispose: () => {
        try {
          dataListener.dispose();
          exitListener.dispose();
          onDataEmitter.dispose();
          onExitEmitter.dispose();
          ptyProcess.kill();
        } catch {}
      },
    };
  }
}
