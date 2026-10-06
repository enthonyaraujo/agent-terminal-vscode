const assert = require('assert');
const { describe, it } = require('node:test');
const { getNextDefaultSessionName } = require('../src/common/sessionNaming.ts');

describe('Session Naming Tests (getNextDefaultSessionName)', () => {
  it('sem sessões abertas deve retornar "Terminal 1"', () => {
    const nextName = getNextDefaultSessionName([]);
    assert.strictEqual(nextName, 'Terminal 1');
  });

  it('com sessões 1 e 2 abertas, fechando a 1 deve retornar "Terminal 1"', () => {
    // Inicialmente com Terminal 1 e Terminal 2
    // Fechando Terminal 1, sobra Terminal 2
    const remaining = ['Terminal 2'];
    const nextName = getNextDefaultSessionName(remaining);
    assert.strictEqual(nextName, 'Terminal 1');
  });

  it('com sessões 1 e 3 abertas deve retornar "Terminal 2"', () => {
    const sessions = ['Terminal 1', 'Terminal 3'];
    const nextName = getNextDefaultSessionName(sessions);
    assert.strictEqual(nextName, 'Terminal 2');
  });

  it('sessões com nomes manuais ou customizados não ocupam número', () => {
    // Exemplo: Terminal 1 ativo e sessões renomeadas ou criadas com agentes
    const sessions = ['Terminal 1', 'Claude Code', 'Codex CLI', 'Servidor de Build'];
    const nextName = getNextDefaultSessionName(sessions);
    assert.strictEqual(nextName, 'Terminal 2');
  });

  it('se só houver sessões renomeadas, deve retornar "Terminal 1"', () => {
    const sessions = ['Claude Code', 'Meu Terminal'];
    const nextName = getNextDefaultSessionName(sessions);
    assert.strictEqual(nextName, 'Terminal 1');
  });

  it('ignora nomes inválidos que não seguem o padrão "Terminal N" com N positivo', () => {
    const sessions = ['Terminal', 'Terminal 0', 'Terminal -1', 'Terminal 1b', 'My Terminal 1'];
    const nextName = getNextDefaultSessionName(sessions);
    assert.strictEqual(nextName, 'Terminal 1');
  });

  it('quando 1, 2 e 3 estão em uso, escolhe "Terminal 4"', () => {
    const sessions = ['Terminal 1', 'Terminal 2', 'Terminal 3'];
    const nextName = getNextDefaultSessionName(sessions);
    assert.strictEqual(nextName, 'Terminal 4');
  });
});
