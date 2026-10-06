const assert = require('assert');
const { describe, it } = require('node:test');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const child_process = require('child_process');
const path = require('path');

describe('Agent Terminal PTY Backend Tests', () => {
  it('should spawn interactive bash with node-pty and show prompt with correct cwd', () => {
    return new Promise((resolve) => {
      const cwd = process.cwd();
      const proc = pty.spawn('bash', ['-i'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });

      let out = '';
      proc.onData((data) => {
        out += data;
      });

      setTimeout(() => {
        proc.write('pwd\n');
      }, 200);

      setTimeout(() => {
        proc.kill();
        assert(out.includes(cwd), `Expected output to include cwd (${cwd}), got: ${out}`);
        assert(out.includes('$') || out.includes('#'), `Expected output to include prompt, got: ${out}`);
        resolve();
      }, 700);
    });
  });

  it('should spawn interactive bash with python-pty helper and show prompt with correct cwd', () => {
    return new Promise((resolve) => {
      const cwd = process.cwd();
      const helperPath = path.join(__dirname, '..', 'resources', 'pty_helper.py');
      const py = child_process.spawn('python3', [helperPath, '80', '24', cwd, 'bash', '-i'], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });

      let buffer = Buffer.alloc(0);
      let out = '';

      py.stdout.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 5) {
          const type = buffer.readUInt8(0);
          const len = buffer.readUInt32BE(1);
          if (buffer.length < 5 + len) break;
          const payload = buffer.subarray(5, 5 + len);
          buffer = buffer.subarray(5 + len);
          if (type === 0x02) {
            out += payload.toString('utf-8');
          }
        }
      });

      setTimeout(() => {
        const data = Buffer.from('pwd\n', 'utf-8');
        const hdr = Buffer.alloc(5);
        hdr.writeUInt8(0x01, 0);
        hdr.writeUInt32BE(data.length, 1);
        py.stdin.write(Buffer.concat([hdr, data]));
      }, 200);

      setTimeout(() => {
        py.kill();
        assert(out.includes(cwd), `Expected output to include cwd (${cwd}), got: ${out}`);
        assert(out.includes('$') || out.includes('#'), `Expected output to include prompt, got: ${out}`);
        resolve();
      }, 700);
    });
  });
});
