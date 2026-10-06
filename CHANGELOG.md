# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.1.2] - 2026-10-06

### Corrigido
- **Numeração Inteligente de Abas:** O nome padrão de novas sessões agora utiliza o menor inteiro positivo disponível ("Terminal N") baseado nas sessões ativas no momento, reutilizando números de abas fechadas (ex.: se o Terminal 1 for fechado mantendo o Terminal 2 aberto, o próximo será "Terminal 1").
- **Eliminação de Contador Incremental:** O cálculo é feito dinamicamente a partir das sessões ativas, sem persistir contador.
- **Isolamento de Nomes Manuais e Agentes:** Sessões renomeadas manualmente ou abertas via "Launch Agent" (ex.: "Claude Code") não ocupam números na sequência padrão.
- **Consistência em Todos os Fluxos:** Aplicado de forma unificada no botão `+`, atalho/comando `agentTerminal.newTerminal`, sessão inicial e "Launch Agent".

### Adicionado
- **Testes Unitários:** Suíte de testes automatizados para a função `getNextDefaultSessionName`.
- **Screenshot Oficial do Layout:** Atualização da documentação no README e no pacote da extensão com screenshot real da interface.

## [0.1.1] - 2026-10-06

### Adicionado
- **Output Channel "Agent Terminal":** Canal de diagnóstico dedicado no painel de saída do VS Code registrando o backend ativo (`node-pty` ou `python-pty`) e eventuais falhas.
- **Aviso Interativo de Fallback:** Notificação informativa com o motivo do erro e o botão "Abrir log" exibida uma única vez por sessão caso o backend nativo falhe.
- **Comando de Log:** `Agent Terminal: Show Output Log` no Command Palette para inspeção imediata.
- **Configuração de Backend:** Setting `agentTerminal.ptyBackend` permitindo escolher entre `"auto"`, `"node-pty"` e `"python"`.
- **Ícone Oficial:** Ícone moderno em PNG (256x256) preparado para o VS Code Marketplace.

### Corrigido
- **Resolução Tipográfica e Largura de Caracteres:** Resolvida a cadeia de fontes do terminal (`terminal.integrated.fontFamily` -> `editor.fontFamily` -> `monospace`) garantindo sempre o fallback `, monospace`.
- **Medição de Células no xterm:** Sincronização com `document.fonts.ready` antes do cálculo do layout (`fit()`), eliminando o espaçamento artificial largo entre caracteres.
- **Invalidação de Cache de Glifos (WebGL):** Chamada de `clearTextureAtlas()` no `WebglAddon` ao detectar alterações de fontes ou temas.
- **Resiliência do Backend PTY:** Tratamento de exceções tanto no `require()` quanto no `spawn()` do `node-pty`, ativando o fallback em Python 3 de forma transparente.

## [0.1.0] - 2026-10-06

### Adicionado
- Lançamento inicial do Agent Terminal.
- Terminal dedicado na barra lateral secundária (Secondary Side Bar) sem mover o terminal inferior.
- Suporte a abas múltiplas com criação, encerramento e renomeação via duplo clique.
- Shell interativo completo (`-i`) carregando `~/.bashrc` e mostrando prompt colorido.
- Seletor de agentes de IA integrado (`Ctrl+Alt+A`).
- Backend duplo: `@homebridge/node-pty-prebuilt-multiarch` (N-API) e `pty_helper.py` (Python 3).
