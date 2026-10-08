# Agent CLI Terminal for Visual Studio Code

Uma extensão leve e de alto desempenho que adiciona um **terminal dedicado na barra lateral secundária (Secondary Side Bar)**, projetado especificamente para executar agentes de IA via linha de comando (**Claude Code**, **Codex CLI**, **Gemini CLI**, **Antigravity CLI**, etc.) ocupando toda a altura da janela, sem interferir nem mover o terminal nativo do VS Code (aba inferior).

---

## Demonstração do Layout

![Demonstração do Layout](resources/screenshot.png)

> **Visualização:** O terminal nativo do VS Code continua embaixo para comandos habituais (build, testes, git), enquanto a barra lateral direita hospeda a TUI do seu agente de IA com altura total.

---

## Requisitos de Sistema

- **VS Code:** Versão `1.106.0` ou superior (versão mínima que suporta a declaração estável de `viewsContainers.secondarySidebar`).
- **Sistemas Suportados:**
  - **Linux e macOS:** Suporte oficial de primeira classe. Inclui aceleração nativa via `node-pty` e redundância com o fallback transparente em Python 3 (`pty_helper.py`).
  - **Windows:** Suporte **não garantido**. O módulo nativo inclui suporte experimental a ConPTY, porém o fallback em Python não funciona em ambientes Windows devido à inexistência do módulo POSIX `pty` na biblioteca padrão do sistema operacional.

---

## Licença

MIT License - Copyright (c) 2026 Enthony Araujo.
