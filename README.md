# Agent CLI Terminal for Visual Studio Code

A lightweight and high-performance extension that adds a **dedicated terminal to the Secondary Side Bar**, specifically designed to run AI CLI agents (**Claude Code**, **Codex CLI**, **Gemini CLI**, **Antigravity CLI**, etc.) taking up the full height of the window, without interfering with or moving VS Code's native terminal (bottom panel).

---

## Layout Demonstration

![Layout Demonstration](resources/screenshot.png)

> **Visualization:** VS Code's native terminal remains at the bottom for regular commands (build, tests, git), while the right sidebar hosts your AI agent's TUI at full height.

---

## System Requirements

- **VS Code:** Version `1.106.0` or higher (minimum version supporting stable `viewsContainers.secondarySidebar` declaration).
- **Supported Systems:**
  - **Linux and macOS:** First-class official support. Includes native acceleration via `node-pty` and transparent fallback redundancy using Python 3 (`pty_helper.py`).
  - **Windows:** Support **not guaranteed**. The native module includes experimental ConPTY support, but the Python fallback does not work in Windows environments due to the absence of the POSIX `pty` module in the OS standard library.

---

## License

MIT License - Copyright (c) 2026 Enthony Araujo.
