/**
 * Retorna o próximo nome padrão no formato "Terminal N", onde N é o menor
 * inteiro positivo (1, 2, 3...) que não está em uso pelo nome de outra sessão aberta
 * que siga o mesmo padrão "Terminal N".
 *
 * Sessões que o usuário renomeou manualmente ou que possuem nomes customizados
 * (ex.: "Claude Code", "build", "Servidor") não ocupam número na sequência.
 */
export function getNextDefaultSessionName(existingNames: Iterable<string>): string {
  const usedNumbers = new Set<number>();
  const pattern = /^Terminal ([1-9]\d*)$/;

  for (const name of existingNames) {
    const match = name.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      usedNumbers.add(num);
    }
  }

  let n = 1;
  while (usedNumbers.has(n)) {
    n++;
  }

  return `Terminal ${n}`;
}
