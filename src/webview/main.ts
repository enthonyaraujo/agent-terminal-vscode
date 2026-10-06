import { Terminal, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import {
  ExtensionToWebviewMessage,
  SessionInfo,
  TerminalConfig,
  WebviewToExtensionMessage,
} from '../common/protocol';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

interface TerminalInstance {
  session: SessionInfo;
  term: Terminal;
  fitAddon: FitAddon;
  webglAddon?: WebglAddon;
  container: HTMLElement;
  viewport: HTMLElement;
  banner?: HTMLElement;
  resizeObserver: ResizeObserver;
}

const instances = new Map<string, TerminalInstance>();
let activeSessionId: string | undefined;

let currentConfig: TerminalConfig = {
  fontFamily: 'monospace',
  fontSize: 14,
  lineHeight: 1,
  letterSpacing: 0,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  copyOnSelect: false,
};

const tabsContainer = document.getElementById('tabs')!;
const terminalsContainer = document.getElementById('terminals-container')!;
const btnNewTab = document.getElementById('btn-new-tab')!;
const btnLaunchAgent = document.getElementById('btn-launch-agent')!;

btnNewTab.addEventListener('click', () => {
  vscode.postMessage({ type: 'newSession' });
});

btnLaunchAgent.addEventListener('click', () => {
  vscode.postMessage({ type: 'launchAgent' });
});

function getThemeFromCss(): ITheme {
  const styles = getComputedStyle(document.documentElement);
  const getVar = (name: string, fallback: string) => {
    const val = styles.getPropertyValue(name).trim();
    return val || fallback;
  };

  return {
    background: getVar('--vscode-terminal-background', '#1e1e1e'),
    foreground: getVar('--vscode-terminal-foreground', '#cccccc'),
    cursor: getVar('--vscode-terminalCursor-foreground', getVar('--vscode-terminal-cursorColor', '#cccccc')),
    cursorAccent: getVar('--vscode-terminal-background', '#1e1e1e'),
    selectionBackground: getVar('--vscode-terminal-selectionBackground', 'rgba(255, 255, 255, 0.25)'),
    black: getVar('--vscode-terminal-ansiBlack', '#000000'),
    red: getVar('--vscode-terminal-ansiRed', '#cd3131'),
    green: getVar('--vscode-terminal-ansiGreen', '#0dbc79'),
    yellow: getVar('--vscode-terminal-ansiYellow', '#e5e510'),
    blue: getVar('--vscode-terminal-ansiBlue', '#2472c8'),
    magenta: getVar('--vscode-terminal-ansiMagenta', '#bc3fbc'),
    cyan: getVar('--vscode-terminal-ansiCyan', '#11a8cd'),
    white: getVar('--vscode-terminal-ansiWhite', '#e5e5e5'),
    brightBlack: getVar('--vscode-terminal-ansiBrightBlack', '#666666'),
    brightRed: getVar('--vscode-terminal-ansiBrightRed', '#f14c4c'),
    brightGreen: getVar('--vscode-terminal-ansiBrightGreen', '#23d18b'),
    brightYellow: getVar('--vscode-terminal-ansiBrightYellow', '#f5f543'),
    brightBlue: getVar('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
    brightMagenta: getVar('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
    brightCyan: getVar('--vscode-terminal-ansiBrightCyan', '#29b8db'),
    brightWhite: getVar('--vscode-terminal-ansiBrightWhite', '#ffffff'),
  };
}

function refitInstance(instance: TerminalInstance): void {
  if (!instance.container.classList.contains('active')) return;

  // Aguarda confirmação das fontes para medição exata da largura de caractere
  document.fonts.ready.then(() => {
    try {
      instance.fitAddon.fit();
      instance.webglAddon?.clearTextureAtlas();
      vscode.postMessage({
        type: 'resize',
        sessionId: instance.session.id,
        cols: instance.term.cols,
        rows: instance.term.rows,
      });
    } catch {}

    // Reforço no frame seguinte caso o DOM ainda estivesse calculando layout
    requestAnimationFrame(() => {
      try {
        instance.fitAddon.fit();
        instance.webglAddon?.clearTextureAtlas();
      } catch {}
    });
  });
}

function updateAllThemes(): void {
  const theme = getThemeFromCss();
  for (const instance of instances.values()) {
    instance.term.options.theme = theme;
    instance.webglAddon?.clearTextureAtlas();
  }
  if (activeSessionId) {
    const active = instances.get(activeSessionId);
    if (active) {
      refitInstance(active);
    }
  }
}

// Watch for VS Code theme changes
const themeObserver = new MutationObserver(() => {
  updateAllThemes();
});
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

function mapCursorStyle(style?: string): 'block' | 'underline' | 'bar' {
  if (style === 'line') return 'bar';
  if (style === 'underline') return 'underline';
  return 'block';
}

function createTerminalInstance(session: SessionInfo): TerminalInstance {
  const container = document.createElement('div');
  container.className = 'terminal-pane';
  container.id = `pane-${session.id}`;

  const viewport = document.createElement('div');
  viewport.className = 'terminal-viewport';
  container.appendChild(viewport);
  terminalsContainer.appendChild(container);

  const term = new Terminal({
    fontFamily: currentConfig.fontFamily || 'monospace',
    fontSize: currentConfig.fontSize,
    lineHeight: currentConfig.lineHeight,
    letterSpacing: currentConfig.letterSpacing,
    fontWeight: currentConfig.fontWeight,
    fontWeightBold: currentConfig.fontWeightBold,
    cursorStyle: mapCursorStyle(currentConfig.cursorStyle),
    cursorBlink: currentConfig.cursorBlink,
    scrollback: currentConfig.scrollback,
    theme: getThemeFromCss(),
    allowProposedApi: true,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const webLinksAddon = new WebLinksAddon((_event, uri) => {
    vscode.postMessage({ type: 'openLink', url: uri });
  });
  term.loadAddon(webLinksAddon);

  const unicode11Addon = new Unicode11Addon();
  term.loadAddon(unicode11Addon);
  term.unicode.activeVersion = '11';

  term.open(viewport);

  let webglAddon: WebglAddon | undefined;
  // Tentar WebglAddon para renderização acelerada, fallback para DOM se falhar
  try {
    webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => {
      webglAddon?.dispose();
      webglAddon = undefined;
    });
    term.loadAddon(webglAddon);
  } catch (err) {
    console.warn('[AgentCliTerminal] WebGL addon unavailable, using standard DOM renderer:', err);
  }

  // Handle keyboard shortcuts (Ctrl+C, Ctrl+Shift+C, Ctrl+Shift+V)
  term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    // Ctrl+C: copy if selected; else pass SIGINT (0x03) to child process
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyC') {
      if (term.hasSelection()) {
        if (e.type === 'keydown') {
          navigator.clipboard.writeText(term.getSelection());
        }
        return false;
      }
      return true; // Let xterm send \x03
    }

    // Ctrl+Shift+C: copy selection
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyC') {
      if (e.type === 'keydown' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection());
      }
      return false;
    }

    // Ctrl+Shift+V: paste
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyV') {
      if (e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            term.paste(text);
          }
        });
      }
      return false;
    }

    return true;
  });

  // Right-click: Copy selection or Paste
  viewport.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    if (term.hasSelection()) {
      await navigator.clipboard.writeText(term.getSelection());
      term.clearSelection();
    } else {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          term.paste(text);
        }
      } catch {}
    }
  });

  // Selection change
  term.onSelectionChange(() => {
    if (currentConfig.copyOnSelect && term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection());
    }
  });

  // Data input
  term.onData((data) => {
    vscode.postMessage({ type: 'input', sessionId: session.id, data });
  });

  const instance: TerminalInstance = {
    session,
    term,
    fitAddon,
    webglAddon,
    container,
    viewport,
    resizeObserver: null as any,
  };

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (activeSessionId === session.id && container.classList.contains('active')) {
      refitInstance(instance);
    }
  });
  ro.observe(viewport);
  instance.resizeObserver = ro;

  instances.set(session.id, instance);
  return instance;
}

function renderTabs(): void {
  tabsContainer.innerHTML = '';

  for (const [id, instance] of instances.entries()) {
    const tab = document.createElement('div');
    tab.className = `tab ${id === activeSessionId ? 'active' : ''}`;
    tab.id = `tab-${id}`;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = instance.session.name;
    title.title = `${instance.session.name} (${instance.session.shell})\nDouble-click to rename`;

    // Rename on double-click
    title.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      title.contentEditable = 'true';
      title.focus();
      document.execCommand('selectAll', false, undefined);
    });

    const commitRename = () => {
      if (title.contentEditable === 'true') {
        title.contentEditable = 'false';
        const newName = title.textContent?.trim() || instance.session.name;
        title.textContent = newName;
        instance.session.name = newName;
        vscode.postMessage({ type: 'renameSession', sessionId: id, name: newName });
      }
    };

    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        title.contentEditable = 'false';
        title.textContent = instance.session.name;
      }
    });

    title.addEventListener('blur', () => {
      commitRename();
    });

    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Close Terminal';
    closeBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.646-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
      </svg>
    `;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'closeSession', sessionId: id });
    });

    tab.appendChild(title);
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => {
      if (activeSessionId !== id) {
        vscode.postMessage({ type: 'selectSession', sessionId: id });
        setActiveSession(id);
      }
    });

    tabsContainer.appendChild(tab);
  }
}

function setActiveSession(sessionId: string): void {
  activeSessionId = sessionId;

  for (const [id, instance] of instances.entries()) {
    if (id === sessionId) {
      instance.container.classList.add('active');
      refitInstance(instance);
      instance.term.focus();
    } else {
      instance.container.classList.remove('active');
    }
  }

  renderTabs();
}

function showExitBanner(instance: TerminalInstance, exitCode: number): void {
  if (instance.banner) return;

  const banner = document.createElement('div');
  banner.className = 'exit-banner';
  banner.innerHTML = `
    <span>Terminal session ended (exit code ${exitCode})</span>
    <div style="display: flex; gap: 6px;">
      <button class="btn-restart">Restart</button>
      <button class="btn-close">Close</button>
    </div>
  `;

  banner.querySelector('.btn-restart')?.addEventListener('click', () => {
    banner.remove();
    instance.banner = undefined;
    vscode.postMessage({ type: 'restartSession', sessionId: instance.session.id });
  });

  banner.querySelector('.btn-close')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'closeSession', sessionId: instance.session.id });
  });

  instance.container.insertBefore(banner, instance.viewport);
  instance.banner = banner;
}

// Handle incoming messages from extension
window.addEventListener('message', (event) => {
  const msg = event.data as ExtensionToWebviewMessage;

  switch (msg.type) {
    case 'init': {
      currentConfig = msg.config;
      terminalsContainer.innerHTML = '';
      instances.clear();

      for (const session of msg.sessions) {
        createTerminalInstance(session);
      }

      // Aguarda o carregamento das fontes antes de posicionar e ajustar a primeira aba
      document.fonts.ready.then(() => {
        if (msg.activeSessionId) {
          setActiveSession(msg.activeSessionId);
        } else if (msg.sessions.length > 0) {
          setActiveSession(msg.sessions[0].id);
        }
      });
      break;
    }

    case 'sessionCreated': {
      createTerminalInstance(msg.session);
      if (msg.activate || instances.size === 1) {
        setActiveSession(msg.session.id);
      } else {
        renderTabs();
      }
      break;
    }

    case 'sessionClosed': {
      const instance = instances.get(msg.sessionId);
      if (instance) {
        instance.resizeObserver.disconnect();
        instance.webglAddon?.dispose();
        instance.term.dispose();
        instance.container.remove();
        instances.delete(msg.sessionId);
      }

      if (activeSessionId === msg.sessionId) {
        const remaining = Array.from(instances.keys());
        if (remaining.length > 0) {
          setActiveSession(remaining[remaining.length - 1]);
        } else {
          activeSessionId = undefined;
        }
      }
      renderTabs();
      break;
    }

    case 'sessionActivated': {
      setActiveSession(msg.sessionId);
      break;
    }

    case 'sessionRenamed': {
      const instance = instances.get(msg.sessionId);
      if (instance) {
        instance.session.name = msg.name;
        renderTabs();
      }
      break;
    }

    case 'output': {
      const instance = instances.get(msg.sessionId);
      if (instance) {
        instance.term.write(msg.data);
      }
      break;
    }

    case 'sessionExit': {
      const instance = instances.get(msg.sessionId);
      if (instance) {
        instance.session.isAlive = false;
        instance.session.exitCode = msg.exitCode;
        showExitBanner(instance, msg.exitCode);
      }
      break;
    }

    case 'updateConfig': {
      Object.assign(currentConfig, msg.config);

      for (const instance of instances.values()) {
        if (msg.config.fontFamily !== undefined) {
          instance.term.options.fontFamily = msg.config.fontFamily || 'monospace';
        }
        if (msg.config.fontSize !== undefined) {
          instance.term.options.fontSize = msg.config.fontSize;
        }
        if (msg.config.lineHeight !== undefined) {
          instance.term.options.lineHeight = msg.config.lineHeight;
        }
        if (msg.config.letterSpacing !== undefined) {
          instance.term.options.letterSpacing = msg.config.letterSpacing;
        }
        if (msg.config.fontWeight !== undefined) {
          instance.term.options.fontWeight = msg.config.fontWeight;
        }
        if (msg.config.fontWeightBold !== undefined) {
          instance.term.options.fontWeightBold = msg.config.fontWeightBold;
        }
        if (msg.config.cursorStyle !== undefined) {
          instance.term.options.cursorStyle = mapCursorStyle(msg.config.cursorStyle);
        }
        if (msg.config.cursorBlink !== undefined) {
          instance.term.options.cursorBlink = msg.config.cursorBlink;
        }
        if (msg.config.scrollback !== undefined) {
          instance.term.options.scrollback = msg.config.scrollback;
        }
        instance.webglAddon?.clearTextureAtlas();
      }

      // Reajusta com medição da nova fonte
      document.fonts.ready.then(() => {
        if (activeSessionId) {
          const active = instances.get(activeSessionId);
          if (active) {
            refitInstance(active);
          }
        }
      });
      break;
    }
  }
});

// Signal extension that Webview is ready
vscode.postMessage({ type: 'ready' });
