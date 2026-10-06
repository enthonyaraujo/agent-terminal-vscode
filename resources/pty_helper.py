#!/usr/bin/env python3
"""
Python PTY Helper for Agent CLI Terminal VS Code Extension.
Acts as a fallback pseudoterminal backend using Python standard library.
Communicates with Node.js via stdin/stdout framing protocol:
[1 byte TYPE] [4 bytes LENGTH (big-endian)] [PAYLOAD]

Types:
0x01: PTY_DATA (Extension -> PTY stdin)
0x02: PTY_OUTPUT (PTY stdout -> Extension)
0x03: RESIZE (Extension -> PTY: 2 bytes rows, 2 bytes cols)
0x04: EXIT (PTY -> Extension: 4 bytes exit code)
0x05: KILL (Extension -> PTY: 1 byte signal number or default 15)
0x06: READY (PTY -> Extension: JSON {"pid": int})
"""

import sys
import os
import pty
import termios
import fcntl
import struct
import select
import json
import signal

MSG_DATA = 0x01
MSG_OUTPUT = 0x02
MSG_RESIZE = 0x03
MSG_EXIT = 0x04
MSG_KILL = 0x05
MSG_READY = 0x06

def set_winsize(fd, rows, cols):
    try:
        ws = struct.pack('HHHH', int(rows), int(cols), 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, ws)
    except Exception:
        pass

def send_msg(msg_type, payload):
    try:
        header = struct.pack('!BI', msg_type, len(payload))
        sys.stdout.buffer.write(header + payload)
        sys.stdout.buffer.flush()
    except (BrokenPipeError, OSError):
        sys.exit(0)

def main():
    if len(sys.argv) < 5:
        print("Usage: pty_helper.py <cols> <rows> <cwd> <command> [args...]", file=sys.stderr)
        sys.exit(1)

    initial_cols = int(sys.argv[1])
    initial_rows = int(sys.argv[2])
    cwd = sys.argv[3]
    cmd = sys.argv[4]
    args = sys.argv[4:]

    master_fd, slave_fd = pty.openpty()
    set_winsize(master_fd, initial_rows, initial_cols)

    # Set non-blocking on master_fd
    fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    # Set non-blocking on stdin
    stdin_fd = sys.stdin.fileno()
    fl_in = fcntl.fcntl(stdin_fd, fcntl.F_GETFL)
    fcntl.fcntl(stdin_fd, fcntl.F_SETFL, fl_in | os.O_NONBLOCK)

    pid = os.fork()
    if pid == 0:
        # Child process
        os.close(master_fd)
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)

        try:
            if os.path.isdir(cwd):
                os.chdir(cwd)
        except Exception:
            pass

        # Environment setup
        os.environ['TERM'] = 'xterm-256color'
        os.environ['COLORTERM'] = 'truecolor'

        try:
            os.execvp(cmd, args)
        except Exception as e:
            sys.stderr.write(f"Failed to execute {cmd}: {e}\n")
            os._exit(127)

    # Parent process
    os.close(slave_fd)

    # Notify extension that pty is ready
    ready_payload = json.dumps({"pid": pid}).encode('utf-8')
    send_msg(MSG_READY, ready_payload)

    in_buffer = bytearray()

    try:
        while True:
            # Check child status
            res_pid, status = os.waitpid(pid, os.WNOHANG)
            if res_pid == pid:
                exit_code = os.waitstatus_to_exitcode(status) if hasattr(os, 'waitstatus_to_exitcode') else (status >> 8)
                # Drain any remaining output from master_fd
                try:
                    while True:
                        data = os.read(master_fd, 8192)
                        if not data:
                            break
                        send_msg(MSG_OUTPUT, data)
                except OSError:
                    pass
                send_msg(MSG_EXIT, struct.pack('!i', exit_code))
                break

            rlist, _, _ = select.select([stdin_fd, master_fd], [], [], 0.05)

            if master_fd in rlist:
                try:
                    data = os.read(master_fd, 8192)
                    if data:
                        send_msg(MSG_OUTPUT, data)
                except (BlockingIOError, InterruptedError):
                    pass
                except OSError:
                    break

            if stdin_fd in rlist:
                try:
                    chunk = os.read(stdin_fd, 8192)
                    if not chunk:
                        # Extension closed stdin
                        break
                    in_buffer.extend(chunk)
                except (BlockingIOError, InterruptedError):
                    pass
                except OSError:
                    break

                # Process all complete messages in buffer
                while len(in_buffer) >= 5:
                    m_type, m_len = struct.unpack('!BI', in_buffer[:5])
                    if len(in_buffer) < 5 + m_len:
                        break
                    m_payload = bytes(in_buffer[5:5 + m_len])
                    del in_buffer[:5 + m_len]

                    if m_type == MSG_DATA:
                        try:
                            os.write(master_fd, m_payload)
                        except OSError:
                            pass
                    elif m_type == MSG_RESIZE:
                        if len(m_payload) >= 4:
                            rows, cols = struct.unpack('!HH', m_payload[:4])
                            set_winsize(master_fd, rows, cols)
                    elif m_type == MSG_KILL:
                        sig = signal.SIGTERM
                        if len(m_payload) >= 1:
                            sig = m_payload[0]
                        try:
                            os.kill(pid, sig)
                        except OSError:
                            pass

    finally:
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass

if __name__ == '__main__':
    main()
