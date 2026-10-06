import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { IPtyBackend, IPtyForkOptions, IPtyProcess } from './ptyBackend';

const MSG_DATA = 0x01;
const MSG_OUTPUT = 0x02;
const MSG_RESIZE = 0x03;
const MSG_EXIT = 0x04;
const MSG_KILL = 0x05;
const MSG_READY = 0x06;

export class PythonPtyBackend implements IPtyBackend {
  readonly name = 'python-pty';
  private helperScriptPath: string;

  constructor(extensionUri: vscode.Uri) {
    this.helperScriptPath = path.join(extensionUri.fsPath, 'resources', 'pty_helper.py');
  }

  spawn(file: string, args: string[], options: IPtyForkOptions): IPtyProcess {
    const helperArgs = [
      this.helperScriptPath,
      String(options.cols || 80),
      String(options.rows || 24),
      options.cwd,
      file,
      ...args,
    ];

    const pyProc = child_process.spawn('python3', helperArgs, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    let pid = pyProc.pid || 0;
    const onDataEmitter = new vscode.EventEmitter<string>();
    const onExitEmitter = new vscode.EventEmitter<{ exitCode: number }>();

    let buffer = Buffer.alloc(0);

    pyProc.stdout?.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 5) {
        const msgType = buffer.readUInt8(0);
        const msgLen = buffer.readUInt32BE(1);

        if (buffer.length < 5 + msgLen) {
          break; // wait for full payload
        }

        const payload = buffer.subarray(5, 5 + msgLen);
        buffer = buffer.subarray(5 + msgLen);

        if (msgType === MSG_READY) {
          try {
            const readyInfo = JSON.parse(payload.toString('utf-8'));
            if (readyInfo.pid) {
              pid = readyInfo.pid;
            }
          } catch {}
        } else if (msgType === MSG_OUTPUT) {
          onDataEmitter.fire(payload.toString('utf-8'));
        } else if (msgType === MSG_EXIT) {
          let code = 0;
          if (payload.length >= 4) {
            code = payload.readInt32BE(0);
          }
          onExitEmitter.fire({ exitCode: code });
        }
      }
    });

    pyProc.on('exit', (code) => {
      onExitEmitter.fire({ exitCode: code ?? 0 });
    });

    const sendMsg = (type: number, payload: Buffer) => {
      if (!pyProc.stdin || pyProc.stdin.destroyed) return;
      const header = Buffer.alloc(5);
      header.writeUInt8(type, 0);
      header.writeUInt32BE(payload.length, 1);
      try {
        pyProc.stdin.write(Buffer.concat([header, payload]));
      } catch {}
    };

    return {
      get pid() {
        return pid;
      },
      onData: onDataEmitter.event,
      onExit: onExitEmitter.event,
      write: (data: string) => {
        sendMsg(MSG_DATA, Buffer.from(data, 'utf-8'));
      },
      resize: (cols: number, rows: number) => {
        const payload = Buffer.alloc(4);
        payload.writeUInt16BE(Math.max(1, rows), 0);
        payload.writeUInt16BE(Math.max(1, cols), 2);
        sendMsg(MSG_RESIZE, payload);
      },
      kill: (signal?: string) => {
        const payload = Buffer.alloc(1);
        payload.writeUInt8(15, 0); // SIGTERM default
        sendMsg(MSG_KILL, payload);
        setTimeout(() => {
          try {
            pyProc.kill('SIGKILL');
          } catch {}
        }, 500);
      },
      dispose: () => {
        onDataEmitter.dispose();
        onExitEmitter.dispose();
        try {
          pyProc.kill('SIGKILL');
        } catch {}
      },
    };
  }
}
