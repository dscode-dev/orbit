/**
 * Proíbe `Promise.all` (e irmãos) sobre consultas do **mesmo cliente
 * transacional**.
 *
 * ## Por que isto é uma regra, e não uma convenção
 *
 * Uma transação interativa do Prisma fica presa a **uma** conexão `pg`, e um
 * cliente `pg` atende uma consulta por vez. Disparar cinco consultas juntas
 * sobre `tx` não as torna paralelas: o driver as enfileira, avisa
 * `client.query() when the client is already executing a query` — e some com o
 * aviso no meio do log. O que muda de verdade é o tempo em que a transação fica
 * aberta segurando a conexão, com o relógio do tempo limite correndo desde o
 * `BEGIN`.
 *
 * Na PR-26.6.1 isso apareceu como transação expirada a 12 s e a 61 s de uma
 * janela de 5 s, e o sintoma visível foi 404 e 500 intermitentes em rotas que
 * não tinham nada a ver com o problema. A regra existe para que a próxima
 * pessoa não precise refazer aquela investigação.
 *
 * ## O que ela **não** proíbe
 *
 * Paralelismo entre chamadas que abrem transações próprias — `Promise.all` de
 * três métodos de repositório é legítimo e continua permitido, porque cada um
 * pega a sua conexão. A regra só olha para identificadores que são clientes de
 * transação: `tx`, `transaction`, `trx`.
 */

const TRANSACTION_CLIENTS = new Set(['tx', 'transaction', 'trx']);
const CONCURRENT = new Set(['all', 'allSettled', 'race', 'any']);

/** `tx.quote.findMany(...)` → a raiz da cadeia é `tx`. */
function rootObject(node) {
  let current = node;
  while (current) {
    if (current.type === 'Identifier') return current.name;
    if (current.type === 'MemberExpression') current = current.object;
    else if (current.type === 'CallExpression') current = current.callee;
    else return null;
  }
  return null;
}

/**
 * Travessia iterativa, com nós já vistos marcados.
 *
 * A versão recursiva ingênua estourava a pilha do ESLint: nós da AST apontam
 * de volta para o pai e para escopos, e sem marcar o que já foi visitado a
 * caminhada vira um ciclo. Só descemos por chaves que contêm nós — o resto da
 * estrutura (posições, comentários, tokens) não interessa e é a maior parte
 * do peso.
 */
function usesTransactionClient(node) {
  const seen = new WeakSet();
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    if (typeof current.type !== 'string') continue;

    if (current.type === 'CallExpression') {
      const root = rootObject(current.callee);
      if (root && TRANSACTION_CLIENTS.has(root)) return true;
    }

    for (const key of Object.keys(current)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = current[key];
      if (value && typeof value === 'object') stack.push(value);
    }
  }

  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Consultas do mesmo cliente transacional devem ser sequenciais',
    },
    schema: [],
    messages: {
      concurrent:
        'Consultas sobre o mesmo cliente transacional ({{client}}) não podem correr em Promise.{{method}}: o driver as serializa mesmo assim e a transação fica aberta por todo o intervalo. Use await sequencial. Ver docs/transaction-concurrency.md.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'Promise' ||
          callee.property.type !== 'Identifier' ||
          !CONCURRENT.has(callee.property.name)
        ) {
          return;
        }

        const [argument] = node.arguments;
        if (!argument || argument.type !== 'ArrayExpression') return;

        const offending = argument.elements.find(
          (element) => element && usesTransactionClient(element),
        );
        if (!offending) return;

        context.report({
          node,
          messageId: 'concurrent',
          data: {
            client: [...TRANSACTION_CLIENTS].join('/'),
            method: callee.property.name,
          },
        });
      },
    };
  },
};
