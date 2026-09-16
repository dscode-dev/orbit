/**
 * Códigos do banco em palavras de produto.
 *
 * O documento impresso é lido por quem não conhece o sistema — o cliente, o
 * fiscal, o síndico. `TECHNICAL_RESPONSIBLE` no lugar de "Responsável técnico"
 * é o tipo de vazamento que faz um documento parecer rascunho de programador.
 *
 * O que não se reconhece sai como veio: inventar uma tradução seria pior que
 * mostrar o código, porque uma tradução errada não dá para desconfiar.
 */
const PAPEIS: Readonly<Record<string, string>> = {
  TECHNICAL_RESPONSIBLE: 'Responsável técnico',
  FIELD_TECHNICIAN: 'Técnico em campo',
  ASSISTANT_TECHNICIAN: 'Técnico auxiliar',
  CUSTOMER: 'Cliente',
  CUSTOMER_REPRESENTATIVE: 'Representante do cliente',
  OWNER: 'Responsável pela organização',
  MANAGER: 'Gestor',
  WITNESS: 'Testemunha',
};

export function roleLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return PAPEIS[code.toUpperCase()] ?? code;
}
