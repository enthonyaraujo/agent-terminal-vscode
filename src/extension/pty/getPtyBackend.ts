import * as vscode from 'vscode';
import { IPtyBackend, IPtyForkOptions, IPtyProcess } from './ptyBackend';
import { NodePtyBackend } from './nodePtyBackend';
import { PythonPtyBackend } from './pythonPtyBackend';
import { Logger } from '../logger';

let fallbackNotificationShown = false;

function showFallbackNotification(logger: Logger, reason: any): void {
  if (fallbackNotificationShown) return;
  fallbackNotificationShown = true;

  const reasonMsg = reason?.message || String(reason || 'Erro desconhecido');
  vscode.window
    .showWarningMessage(
      `Agent CLI Terminal: O módulo nativo node-pty falhou (${reasonMsg}). O fallback em Python 3 foi ativado.`,
      'Abrir log'
    )
    .then((selection) => {
      if (selection === 'Abrir log') {
        logger.show();
      }
    });
}

export class AutoPtyBackend implements IPtyBackend {
  readonly name = 'auto';
  private primaryBackend: NodePtyBackend | null = null;
  private fallbackBackend: PythonPtyBackend;
  private activeBackend: IPtyBackend;

  constructor(
    private extensionUri: vscode.Uri,
    private logger: Logger
  ) {
    this.fallbackBackend = new PythonPtyBackend(extensionUri);

    // No Windows, Python standard library não possui módulo pty POSIX
    if (process.platform === 'win32') {
      try {
        this.primaryBackend = new NodePtyBackend();
        this.activeBackend = this.primaryBackend;
        this.logger.info('Backend selecionado: node-pty (ConPTY para Windows)');
      } catch (err: any) {
        this.logger.error('Falha ao carregar ConPTY no Windows:', err);
        throw err;
      }
      return;
    }

    // Em Linux / macOS:
    try {
      this.primaryBackend = new NodePtyBackend();
      this.activeBackend = this.primaryBackend;
      this.logger.info('Backend selecionado: node-pty (@homebridge/node-pty-prebuilt-multiarch)');
    } catch (err: any) {
      this.logger.warn('Falha no require() do módulo nativo node-pty. Ativando fallback para Python 3.');
      this.logger.error('Erro original do require():', err);
      showFallbackNotification(this.logger, err);
      this.activeBackend = this.fallbackBackend;
      this.logger.info('Backend ativo alterado para: python-pty');
    }
  }

  get currentActiveBackendName(): string {
    return this.activeBackend.name;
  }

  spawn(file: string, args: string[], options: IPtyForkOptions): IPtyProcess {
    if (this.primaryBackend && this.activeBackend === this.primaryBackend) {
      try {
        const proc = this.primaryBackend.spawn(file, args, options);
        this.logger.info(`Shell iniciado via node-pty (PID: ${proc.pid}, cmd: ${file})`);
        return proc;
      } catch (err: any) {
        this.logger.warn('Falha na chamada spawn() do node-pty nativo. Ativando fallback para Python 3.');
        this.logger.error('Erro original do spawn():', err);
        showFallbackNotification(this.logger, err);
        this.activeBackend = this.fallbackBackend;
        this.logger.info('Backend ativo alterado para: python-pty');
      }
    }

    const proc = this.fallbackBackend.spawn(file, args, options);
    this.logger.info(`Shell iniciado via python-pty (PID: ${proc.pid}, cmd: ${file})`);
    return proc;
  }
}

export function getPtyBackend(extensionUri: vscode.Uri, logger: Logger): IPtyBackend {
  const config = vscode.workspace.getConfiguration('agentCliTerminal');
  const backendChoice = config.get<string>('ptyBackend', 'auto');

  logger.info(`Configuração agentCliTerminal.ptyBackend: "${backendChoice}"`);

  if (backendChoice === 'python') {
    logger.info('Backend selecionado explicitamente: python-pty (pty_helper.py).');
    return new PythonPtyBackend(extensionUri);
  }

  if (backendChoice === 'node-pty') {
    logger.info('Backend selecionado explicitamente: node-pty (nativo).');
    try {
      return new NodePtyBackend();
    } catch (err: any) {
      logger.error('Falha ao instanciar backend forçado node-pty:', err);
      throw err;
    }
  }

  // 'auto' mode
  return new AutoPtyBackend(extensionUri, logger);
}
