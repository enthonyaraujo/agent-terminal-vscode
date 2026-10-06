import * as vscode from 'vscode';
import { IPtyBackend } from './ptyBackend';
import { NodePtyBackend } from './nodePtyBackend';
import { PythonPtyBackend } from './pythonPtyBackend';

export function getPtyBackend(extensionUri: vscode.Uri): IPtyBackend {
  const config = vscode.workspace.getConfiguration('agentTerminal');
  const backendChoice = config.get<string>('ptyBackend', 'auto');

  if (backendChoice === 'python') {
    return new PythonPtyBackend(extensionUri);
  }

  if (backendChoice === 'node-pty') {
    return new NodePtyBackend();
  }

  // 'auto' mode: try node-pty first, fallback to python
  try {
    const nodeBackend = new NodePtyBackend();
    return nodeBackend;
  } catch (err) {
    console.warn('[AgentTerminal] Failed to load node-pty backend, falling back to python-pty:', err);
    return new PythonPtyBackend(extensionUri);
  }
}
