# Transações, concorrência e o contexto de RLS (PR-26.6.1)

Por que consultas do mesmo cliente transacional são sequenciais, por que a
janela da transação é de 20 s, e o que aconteceu quando não era.

---

## O defeito

Depois da PR-26.6 — papel restrito, RLS efetivamente avaliada — a suíte E2E
completa passou a falhar de forma intermitente: **4 de 7 execuções**, sempre em
testes diferentes, com sintomas que não conversavam entre si.

```
GET  /automations                    → 404
POST /management-reports             → 404
POST /automations/:id/toggle         → 404
POST /quotes/:id/items               → 500
POST /artifact-manifests/:id/file    → 404
(um teste)                           → socket hang up
(outro)                              → timeout de 60 s
```

Cada suíte, isolada, passava — nove execuções seguidas da suíte de Automations
sem uma falha. Só o conjunto reproduzia.

## A hipótese que estava errada

A pista inicial era o aviso do `pg`:

```
client.query() when the client is already executing a query is deprecated
```

e 31 `Promise.all` dentro de caminhos transacionais. A hipótese: consultas
concorrentes sobre a mesma conexão embaralhavam o `set_config`, e a política de
RLS via contexto vazio.

**Descartada por medição.** Um teste de estresse com 336 requisições
concorrentes de dois inquilinos não produziu um único 404. E a instrumentação
colocada no ponto exato de falha — `SubscriptionPlanRepository`, que responde
404 quando não enxerga a organização — **nunca disparou** durante uma execução
que falhou. O 404 não vinha de lá.

O `node-postgres` enfileira consultas de um mesmo cliente; ele não as
multiplexa. O aviso é real e o padrão é ruim, mas não corrompe contexto.

## A causa raiz

Instrumentando o filtro de exceção para registrar 4xx (`LOG_CLIENT_ERRORS`), a
execução seguinte trouxe a resposta:

```
Transaction API error: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 12718 ms passed
since the start of the transaction.

Transaction API error: A commit cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 61534 ms passed
since the start of the transaction.
```

**Transações interativas expirando.** A janela padrão do Prisma é 5 s, contados
do `BEGIN` — tempo de parede, não tempo de banco. E o Orbit renderiza PDF
**dentro do processo**: `pdfkit` é trabalho síncrono, e enquanto ele roda o laço
de eventos não avança. Qualquer transação aberta naquele instante fica com o
relógio correndo e o trabalho parado.

Uma transação de 61 s numa janela de 5 s não é uma transação lenta. É uma
transação **parada** enquanto outra coisa segurava o processo.

O erro resultante aparece longe da origem: a transação morta pertence a uma
requisição qualquer, que devolve 500, ou devolve 404 porque a leitura que
falhou era um `findFirst` cujo `null` significa "não existe". Daí o sintoma
espalhado e sem padrão.

### Por que só apareceu depois da PR-26.6

Três coisas mudaram o perfil de transações:

1. **Mais transações.** `BackgroundJobQueue.enqueue` sem cliente do chamador
   passou a abrir uma transação — antes era um `INSERT` em autocommit. O mesmo
   para `claim`, `succeed`, `fail`, `requeueStalled`, que precisam declarar
   `app.job_worker`.
2. **Transações mais caras.** `RlsTransaction` declarava o contexto em **sete**
   `SELECT set_config(...)` sequenciais. Sete idas ao banco antes da primeira
   consulta útil, em toda transação da aplicação.
3. **Pool no limite.** O `pg` abre no máximo 10 conexões por padrão. Medindo
   durante a suíte: **10 de 10 em uso**, com `idle in transaction` constante.
   Uma transação interativa segura a conexão do `BEGIN` ao `COMMIT`.

Nada disso era errado isoladamente. Juntos, estreitaram a margem até que um PDF
rendendo em segundo plano bastasse para estourar a janela.

---

## As correções

### 1. Uma ida ao banco para declarar o contexto, não sete

`set_config` devolve valor, então os sete campos cabem numa projeção só:

```sql
SELECT set_config('app.user_id', $1, true),
       set_config('app.organization_id', $2, true),
       ...
```

Mesma semântica, mesma localidade (`is_local = true`), **1 round trip em vez de
7** — em toda transação do sistema.

### 2. Janela de transação e pool dimensionados

| Ajuste | Antes | Agora | Variável |
|---|---|---|---|
| Tempo limite da transação | 5 s (padrão Prisma) | 20 s | `DATABASE_TRANSACTION_TIMEOUT_MS` |
| Espera por conexão | 2 s (padrão Prisma) | 10 s | `DATABASE_TRANSACTION_MAX_WAIT_MS` |
| Conexões no pool | 10 (padrão `pg`) | 20 | `DATABASE_POOL_MAX` |

Aumentar a janela **não** é licença para transação longa. É reconhecer que o
relógio mede tempo de parede num processo que também renderiza documento. A
regra de escopo continua a mesma: transação faz trabalho de banco, e nada mais.

> O trabalho síncrono de renderização prendendo o laço de eventos continua sendo
> um problema — só não é *este* problema. Fica registrado como dívida: mover a
> renderização para fora do processo (worker dedicado ou `worker_threads`).

### 3. Consultas do mesmo cliente transacional, sequenciais

31 ocorrências auditadas, todas na mesma classe:

| Classe | Ocorrências |
|---|---|
| `UNSAFE_SAME_TRANSACTION` — consultas concorrentes sobre `tx` | **31** |
| `SAFE_DIFFERENT_CONNECTIONS` — `Promise.all` de métodos que abrem transação própria | 15 (mantidas) |
| `SAFE_OUTSIDE_TRANSACTION` | — |
| `UNKNOWN` | 0 |

As 31 viraram `await` sequencial. Não porque corrompessem — o driver já as
serializava —, mas porque o paralelismo era **ilusório** e o custo era real: a
transação ficava aberta pelo tempo somado de todas elas.

As 15 seguras foram deliberadamente preservadas. `Promise.all` de três métodos
de repositório é legítimo: cada um pega a própria conexão, e serializá-los seria
uma regressão de desempenho sem ganho de correção.

```ts
// ❌ mesmo cliente transacional
const [rows, total] = await Promise.all([tx.quote.findMany(…), tx.quote.count(…)]);

// ✅ mesmo cliente transacional
const rows = await tx.quote.findMany(…);
const total = await tx.quote.count(…);

// ✅ conexões independentes — continua permitido
const [coverages, current] = await Promise.all([
  this.repository.listCoverages(…),
  this.repository.currentExecution(…),
]);
```

### 4. Uma transação de guard por requisição, não três

Três guardas perguntam a **mesma** coisa sobre a **mesma** organização na mesma
requisição — assinatura ativa, plano aceito, capacidade concedida. Cada um
abria a própria transação interativa: três conexões do pool e três janelas de
tempo limite a atravessar **antes** de o handler começar.

Os guardas agora resolvem as permissões uma vez e guardam a **promessa** no
objeto da requisição, sob um `Symbol`. Memoização de escopo de requisição: nasce
e morre com ela, então não há como servir o plano de um inquilino a outro. A
regra em si foi separada da consulta — `assertActiveOn`, `assertPlanOn`,
`assertCapabilitiesOn` recebem permissões já resolvidas.

Foi a correção que sobrou depois que as transações expiradas zeraram: a suíte
completa ainda apresentava uma falha por execução, e o sintoma decisivo foi um
teste que esperava **403** e recebeu **404** — o guard de plano respondendo
"organização não existe" no lugar da recusa de permissão.

### 5. Guarda contra regressão

Regra ESLint local `orbit/no-concurrent-transaction-queries`, em
`eslint-rules/no-concurrent-transaction-queries.mjs`. Ela olha para
`Promise.all`/`allSettled`/`race`/`any` cujos elementos chamam algo em `tx`,
`transaction` ou `trx`, e recusa. Não usa regex: percorre a AST e resolve a raiz
da cadeia de acesso, então `tx.a.b.findMany()` é reconhecido e
`this.repository.x()` não gera falso positivo.

Escolhida em vez de convenção ou teste de arquitetura porque o erro é local, tem
forma sintática exata, e o custo de detectá-lo tarde já foi medido.

### 6. Diagnóstico permanente

Duas superfícies novas, ambas desligadas ou silenciosas por padrão:

- **`SubscriptionPlanRepository`** — quando o guard de plano não enxerga a
  organização, pergunta ao Postgres, na mesma transação, qual contexto está
  valendo, e classifica: `CONTEXT_MISSING`, `CONTEXT_MISMATCH` ou
  `POLICY_DENIED_OR_ABSENT`. Externamente continua sendo 404; internamente a
  diferença entre "não existe" e "não vejo" fica registrada.
- **`LOG_CLIENT_ERRORS=true`** — registra 4xx com rota, código e mensagem. Foi o
  que encontrou a causa raiz; sem ele, status sem mensagem não distingue nada.

---

## Prova

| Verificação | Resultado |
|---|---|
| Estresse de concorrência (336 requisições, 2 inquilinos, 4 unidades) | 0 erro espúrio, 0 cross-tenant |
| Transações de guard por requisição | 3 → 1 |
| Contexto vale da primeira à última consulta, com `pg_sleep` no meio | ✓ |
| Duas transações concorrentes não compartilham contexto | ✓ |
| Contexto não sobrevive a `COMMIT` nem a `ROLLBACK` | ✓ |
| 19 testes de RLS real | ✓ |
| `expired transaction` no log da suíte completa | **0** |

---

## Regras práticas

1. Dentro de uma transação, `await` sequencial. Se der vontade de paralelizar,
   ou a transação está grande demais, ou as consultas não precisavam da mesma
   transação.
2. Nada de trabalho de CPU dentro de transação — renderizar, comprimir,
   assinar. O relógio é de parede.
3. Nada de chamada de rede dentro de transação.
4. `Promise.all` entre requisições e entre métodos que abrem transações
   próprias continua certo, e continua permitido.
5. Transação que precise de mais de 20 s está errada, não apertada.
