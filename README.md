# Agent Terminal for Visual Studio Code

Uma extensão leve e de alto desempenho que adiciona um **terminal dedicado na barra lateral secundária (Secondary Side Bar)**, projetado especificamente para executar agentes de IA via linha de comando (**Claude Code**, **Codex CLI**, **Gemini CLI**, **Antigravity CLI**, etc.) ocupando toda a altura da janela, sem interferir nem mover o terminal nativo do VS Code (aba inferior).

---

## Principais Recursos

- **Convivência sem conflitos:** O terminal inferior padrão do VS Code continua funcionando normalmente. O Agent Terminal fica na barra lateral direita.
- **Shell 100% Interativo:** Abre o shell com a flag `-i` (modo interativo) e respeita seus arquivos de inicialização (`~/.bashrc`, `~/.zshrc`), exibindo o prompt completo com cores, caminho e estilo (ex.: `usuario@host:~/projeto$`).
- **Resolução de CWD & Ambiente:** Inicializa automaticamente na pasta raiz do workspace aberto, respeita `terminal.integrated.defaultProfile`, variáveis de ambiente customizadas e suporte a truecolor (`COLORTERM=truecolor`).
- **Renderização Rápida e Leve:** Baseado em **xterm.js v6** com aceleração via **WebGL** (e fallback automático para DOM/canvas). Zero frameworks pesados (HTML/CSS/TS puros).
- **Sem Perda de Histórico:** O terminal utiliza `retainContextWhenHidden: true`, mantendo TUIs em execução (Claude Code, curses, Ink) ativas em segundo plano sem perda de estado e sem "flicker".
- **Múltiplas Abas:** Alterne entre diferentes sessões de agentes, crie novas abas (`+`), feche abas (`x`) e renomeie qualquer aba com **duplo clique**.
- **Seletor de Agentes Integrado:** Menu rápido (QuickPick) para disparar agentes pré-configurados ou comandos personalizados em uma nova aba ou na aba atual.
- **Suporte Avançado a Teclado:**
  - `Ctrl+C`: Se houver seleção, copia o texto. Se não houver seleção, envia `SIGINT` (`^C`) diretamente para cancelar a ação do agente.
  - `Ctrl+Shift+C`: Copia seleção para o clipboard.
  - `Ctrl+Shift+V` ou **Botão Direito**: Cola com *bracketed paste mode* ativo (essencial para colar grandes prompts sem disparar execuções acidentais).
  - Links de terminal clicáveis abrindo no navegador padrão.
- **Backend PTY Resiliente e Sem Compilação:** Utiliza `@homebridge/node-pty-prebuilt-multiarch` (N-API, estável entre versões de Node e Electron do VS Code) com fallback transparente para um helper em **Python 3** padrão no Linux/macOS.

---

## Instalação

### Via Linha de Comando (.vsix)
```bash
code --install-extension agent-terminal-0.1.0.vsix
```

### Pela Interface do VS Code
1. Abra a aba de **Extensões** (`Ctrl+Shift+X`).
2. Clique no menu de três pontos (`...`) no canto superior da lista de extensões.
3. Selecione **Install from VSIX...** e escolha o arquivo `agent-terminal-0.1.0.vsix`.

---

## Como Posicionar na Barra Lateral Secundária

No VS Code moderno (1.97+), o **Agent Terminal** já é registrado nativamente em `secondarySidebar` e deve aparecer no painel lateral à direita.

Se você estiver utilizando uma versão que posicione o container na Activity Bar esquerda ou se desejar reposicionar:
1. Pressione `Ctrl+Alt+B` (ou clique no ícone no canto superior direito do VS Code) para exibir a **Secondary Side Bar**.
2. Clique no ícone do **Agent Terminal** e **arraste-o para a barra lateral secundária**.
3. O VS Code memoriza essa posição permanentemente.

---

## Atalhos de Teclado Padrão

| Ação | Atalho (Linux/Windows) | Atalho (macOS) |
| :--- | :--- | :--- |
| **Focar no Agent Terminal** | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| **Novo Terminal / Nova Aba** | `Ctrl+Alt+N` | `Cmd+Alt+N` |
| **Lançar Agente de IA** | `Ctrl+Alt+A` | `Cmd+Alt+A` |
| **Encerrar Terminal / Fechar Aba** | `Ctrl+Alt+W` | `Cmd+Alt+W` |
| **Interromper Processo (SIGINT)** | `Ctrl+C` *(sem seleção)* | `Ctrl+C` *(sem seleção)* |
| **Copiar Texto** | `Ctrl+Shift+C` *(ou Ctrl+C com seleção)* | `Cmd+C` |
| **Colar Texto** | `Ctrl+Shift+V` *(ou Botão Direito)* | `Cmd+V` |

---

## Configuração

Você pode personalizar os agentes e opções no seu `settings.json`:

```json
{
  // Lista de agentes de IA disponíveis no QuickPick (Ctrl+Alt+A)
  "agentTerminal.agents": [
    { "name": "Claude Code", "command": "claude" },
    { "name": "Codex CLI", "command": "codex" },
    { "name": "Gemini CLI", "command": "gemini" },
    { "name": "Antigravity", "command": "agy" }
  ],

  // Copiar automaticamente o texto selecionado
  "agentTerminal.copyOnSelect": false,

  // Backend de pseudoterminal: "auto" (recomendado), "node-pty", ou "python"
  "agentTerminal.ptyBackend": "auto"
}
```

O Agent Terminal também herda automaticamente suas preferências de terminal do VS Code:
- `terminal.integrated.fontFamily`
- `terminal.integrated.fontSize`
- `terminal.integrated.lineHeight`
- `terminal.integrated.cursorStyle`
- `terminal.integrated.cursorBlink`
- `terminal.integrated.scrollback`
- Cores do tema ativo do editor (`--vscode-terminal-*`)

---

## Solução de Problemas

### 1. O comando do agente não é encontrado (`command not found`)
Certifique-se de que a CLI do agente está instalada e disponível no seu `$PATH`. Se você instalou a ferramenta globalmente via npm, pip ou cargo em um diretório de usuário (ex.: `~/.local/bin` ou `~/.cargo/bin`), especifique o comando com caminho completo ou garanta que ele seja exportado no seu `~/.bashrc` / `~/.zshrc`.

### 2. O prompt do shell parece desconfigurado
O Agent Terminal adiciona automaticamente a flag `-i` para forçar o bash/zsh a carregar scripts como Starship, Oh-My-Bash ou powerline. Caso tenha configurações condicionais no seu arquivo de inicialização, verifique se elas dependem da variável `TERM=xterm-256color`.

### 3. Falha ao carregar backend nativo
A extensão inclui uma camada de contingência automática em Python 3. Se por algum motivo o módulo Node nativo for bloqueado pelo sistema operacional, ela alternará automaticamente para o backend Python sem exigir nenhuma ação manual.

---

## Desenvolvimento e Testes

```bash
# Instalar dependências
npm install

# Compilar extensão e webview
npm run compile

# Executar testes unitários do PTY (Node e Python)
npm test

# Modo de desenvolvimento contínuo (watch)
npm run watch

# Empacotar pacote .vsix para distribuição
npm run package
```

---

## Licença

MIT License.
