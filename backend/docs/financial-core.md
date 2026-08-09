# Financial Core (PR-21)

Registro de entradas e saídas de dinheiro por organização e unidade de
negócio, com origem rastreável e integração automática a recibos emitidos.

## O que este domínio não é

Não é contabilidade. Não há partidas dobradas, plano de contas, conciliação
bancária, apuração fiscal, gateway de pagamento nem fechamento contábil. O que
existe é o **fato financeiro**: entrou ou saiu, quanto, quando, de que
categoria, por qual origem — e quem mexeu nisso.

Essa fronteira é deliberada. Um ERP que promete contabilidade e entrega
lançamento avulso produz um número que parece oficial e não é.

## Modelo

### `financial_entries`

| Campo | Papel |
| --- | --- |
| `type` | `INCOME` · `EXPENSE`. **O sinal está aqui**, nunca no valor: despesa é `EXPENSE` com valor positivo. Sem isso, somar a coluna daria um resultado que depende de como cada lançamento foi digitado. |
| `status` | `PENDING` (previsão) · `CONFIRMED` (realizado) · `CANCELLED` (deixou de valer, continua existindo) |
| `source` | `MANUAL` · `RECEIPT` · `QUOTE` · `SYSTEM` |
| `source_entity_id` | Registro que originou o lançamento; nulo em manual |
| `amount` | `DECIMAL(14,2)`, sempre `> 0` por CHECK |
| `competence_date` | `DATE` — quando o fato aconteceu, não quando foi digitado |
| `due_date` | Vencimento previsto, opcional |
| `business_unit_id` | **Obrigatório**: dinheiro é contado por unidade. Um lançamento de duas unidades seria rateio, decisão contábil que este domínio não toma. |

Confirmação e cancelamento gravam autor, data e — no cancelamento — motivo
obrigatório.

### `financial_categories`

Catálogo por organização, com dez categorias HVAC-R semeadas na primeira
abertura do módulo. **Nenhuma delas é referenciada por código**: todas podem
ser renomeadas, e o serviço funciona igual se a organização apagar as
semeadas e criar as suas. `type` não é editável — trocar o lado de uma
categoria já usada mudaria o sinal de lançamentos passados sem que ninguém os
tocasse.

### `financial_settings`

| Campo | Efeito real |
| --- | --- |
| `auto_record_receipts` | Recibo oficialmente emitido vira receita confirmada |
| `default_currency` | Moeda dos lançamentos criados sem moeda explícita |

Dois campos, dois comportamentos que o servidor executa. Não é depósito de
flags: um interruptor que ninguém lê não entra aqui.

## Invariantes garantidos pelo banco

```sql
-- Um lançamento por registro de origem, para sempre.
CREATE UNIQUE INDEX financial_entries_source_entity_unique
  ON financial_entries(organization_id, source, source_entity_id)
  WHERE source <> 'MANUAL' AND source_entity_id IS NOT NULL;
```

O predicado **não** filtra `deleted_at` nem `status`. Um lançamento cancelado
ainda é prova de que aquele recibo foi processado; recriá-lo devolveria a
receita ao caixa depois de alguém tê-la estornado.

Demais restrições:

- `amount > 0`
- `type IN ('INCOME','EXPENSE')`, `status IN (…)`, `source IN (…)`
- `CONFIRMED` exige `confirmed_at`; `CANCELLED` exige `cancelled_at` — um
  estado sem o seu carimbo seria um registro que não sabe explicar quando
  virou o que é

## Isolamento

RLS em todas as três tabelas, com `FORCE ROW LEVEL SECURITY`.

- categorias e configuração: `organization_id = app_current_organization_id()`
- **lançamentos: organização _e_ unidade** —
  `business_unit_id = ANY(app_current_business_unit_ids())`

Quem tem acesso a uma unidade não lê o caixa de outra, mesmo que o `where` do
TypeScript esqueça a cláusula.

## Autorização

`financial.read` vê; `financial.manage` lança, confirma e cancela. As duas são
**independentes** de `operations.read` e `crm.read`: quem enxerga a operação ou
o cliente não passa a enxergar o dinheiro deles, e filtrar por `customerId`
continua exigindo permissão financeira.

Na migração, as permissões são concedidas apenas a papéis que já administram a
organização (`'*' = ANY(permissions)`). Papel operacional não recebe nada.

`financial.controller.spec.ts` percorre todas as rotas do controlador e falha
se alguma esquecer capability ou permissão financeira — inclusive rotas
acrescentadas depois.

## Recibo → Financeiro

```
POST /artifact-manifests/:id/issue
        │
        ▼
ArtifactManifestRepository.issue()  ── transação ──┐
  status = ISSUED, issuedAt, isActive              │
  AuditLog ARTIFACT_MANIFEST_ISSUED                │
  enqueue(artifact.manifest.issued, jobKey = id)  ─┘  outbox
        │
        ▼  worker, no contexto do tenant
ReceiptEntryProcessor
  artifactType ∈ RECEIPT_ARTIFACT_TYPES?
  autoRecordReceipts ligado?
  valor resolvível?
        │
        ▼
FinancialEntry  INCOME · CONFIRMED · source RECEIPT · sourceEntityId = manifestId
```

**O gatilho é a emissão, não a renderização.** Renderizar produz bytes;
`confirmFile` emite um arquivo enviado de fora, sem renderer nenhum; e uma
renderização que falha ao emitir não gerou recibo algum. Amarrar o Financeiro
ao Rendering Engine criaria receita a partir de rascunho.

**O Document Center não conhece o Financeiro.** A fila leva o nome do evento
(`artifact.manifest.issued`), não do consumidor. Se amanhã o evento interessar
a notificações ou a um webhook, ninguém volta ao módulo de manifestos.

### Resolução do valor

O processador **não procura o campo pelo id** `valor` — isso amarraria o
Financeiro ao template oficial e falharia no primeiro recibo customizado. O que
identifica dinheiro é um campo numérico cuja **unidade é código de moeda**,
informação que o contrato do template já carrega.

Com zero ou mais de um campo monetário, **nenhum lançamento é criado** e o
motivo vai para o log. Um lançamento de R$ 0,00, ou um valor escolhido entre
vários candidatos, é pior que lançamento nenhum: ninguém confere o que não sabe
que está errado.

A competência é a data declarada no documento quando ele tem **uma** data; caso
contrário, a emissão. Um recibo emitido no dia 3 referente a pagamento do dia 28
pertence ao mês do pagamento.

### Idempotência

Garantida em três camadas, e a que vale é a última:

1. `jobKey` = id do manifesto — a mesma emissão não vira dois jobs;
2. o processador consulta antes de inserir;
3. **o índice único parcial do banco** — `INSERT … ON CONFLICT DO NOTHING`
   devolve zero linhas e o processador entende isso como "outro já fez".

Só a terceira sobrevive a concorrência real. As duas primeiras reduzem trabalho
inútil; nenhuma delas garante coisa alguma sozinha.

### Configuração desligada

`autoRecordReceipts = false` **não apaga** o que já foi lançado — são fatos, e o
recibo que os originou continua existindo. Religar **não recupera** o período
desligado: o gatilho é o evento de emissão, e eventos passados não são
reemitidos. Uma configuração que reescrevesse o histórico dos dois lados faria o
caixa depender de quando alguém mexeu no botão.

## Analytics

Servido em `/financial/analytics/*`, **fora de `/analytics`** — aquele
controlador exige `analytics.read` na classe inteira, e publicar finanças ali
daria faturamento a quem só tem indicadores operacionais. O vocabulário de
período e KPI é o mesmo; a porta é que é outra.

Realizado e previsto saem **separados**, e não existe campo que os some:

```json
{
  "income":  { "confirmed": "1000.00", "pending": "500.00", "cancelled": "0.00", "count": 3 },
  "expense": { "confirmed": "250.00",  "pending": "100.00", "cancelled": "0.00", "count": 2 },
  "netConfirmed": "750.00",
  "netPending": "400.00",
  "overdue": { "pending": "100.00", "count": 1 }
}
```

Um "saldo" que misturasse `PENDING` com `CONFIRMED` pareceria caixa e não seria.

## Endpoints

| Método | Rota | Capability · Permissão |
| --- | --- | --- |
| `GET` | `/financial/entries` | `financial.read` |
| `GET` | `/financial/entries/:id` | `financial.read` |
| `POST` | `/financial/entries` | `financial.manage` |
| `PATCH` | `/financial/entries/:id` | `financial.manage` |
| `POST` | `/financial/entries/:id/confirm` | `financial.manage` |
| `POST` | `/financial/entries/:id/cancel` | `financial.manage` |
| `GET` | `/financial/categories` | `financial.read` |
| `POST` | `/financial/categories` | `financial.manage` |
| `PATCH` | `/financial/categories/:id` | `financial.manage` |
| `DELETE` | `/financial/categories/:id` | `financial.manage` |
| `GET` | `/financial/analytics/summary` | `financial.read` |
| `GET` | `/financial/analytics/categories` | `financial.read` |
| `GET` | `/financial/analytics/timeline` | `financial.read` |
| `GET` | `/financial/settings` | `financial.read` |
| `PATCH` | `/financial/settings` | `financial.manage` |

Cancelamento é `POST`, e não `DELETE`: o lançamento não é removido, e um
`DELETE` que preserva o registro mentiria sobre o que acontece.

`GET /financial/entries` aceita `search`, `type`, `status`, `source`,
`categoryId`, `businessUnitId`, `customerId`, `operationId`, `from`, `to`,
`overdue`, `page`, `limit` — paginação no servidor, com os índices
correspondentes na migração.

## Alterações fora do módulo

Três, todas justificadas antes de escritas:

1. **`BackgroundJobQueue.enqueue` aceita transação opcional.** Sem isso o
   enfileiramento fica fora da transação de emissão: um processo que morre entre
   o commit e o enqueue deixa o recibo gravado e a receita nunca lançada — perda
   silenciosa de faturamento. Parâmetro opcional; o caminho existente não mudou.
   O caminho transacional usa `ON CONFLICT DO NOTHING` em vez de capturar
   `P2002`, porque no Postgres uma violação de unicidade aborta a transação
   inteira e a leitura de recuperação falharia.

2. **`JobProcessorRegistry` substitui o token `JOB_PROCESSOR`.** O array
   injetado só enxergava o módulo onde o worker é declarado; com a segunda fila,
   vinda de um módulo que aquele não importa, o processador novo nunca rodaria —
   silenciosamente, sem erro e sem job processado. Agora cada processador se
   inscreve ao subir e o worker percorre o registro.

3. **`ArtifactManifestRepository.issue` publica o evento.** É o único ponto que
   grava `issuedAt`. Nada ali conhece o Financeiro.

## Preparado, não implementado

`FinancialEntrySource.QUOTE` e o estado `PENDING` já existem no contrato e no
banco, com a mesma trava de origem. O caminho
`Quote → PENDING INCOME → Receipt → CONFIRMED INCOME` precisa apenas do módulo
de orçamentos: o evento de aprovação lança `PENDING`, e a emissão do recibo
confirma. `ORCAMENTO` está deliberadamente fora de `RECEIPT_ARTIFACT_TYPES` —
incluí-lo agora transformaria proposta em faturamento.

Ausências declaradas, não disfarçadas: conciliação bancária, fiscal, gateway de
pagamento, contabilidade, parcelamento, recorrência, centro de custo e
conversão entre moedas (`SUPPORTED_CURRENCIES` aceita três códigos, mas não há
taxa de câmbio — totais de moedas diferentes não são somados porque o resumo
publica a moeda padrão da organização).

## Testes

- `financial.service.spec.ts` — 18 casos de regra de domínio
- `financial.controller.spec.ts` — 46 asserções de guarda, rota a rota
- `test/financial.e2e-spec.ts` — 15 casos contra a aplicação montada:
  configuração e categorias semeadas sem duplicação, ciclo
  criar/confirmar/cancelar, recusa de valor negativo e moeda desconhecida,
  paginação, recibo emitido virando receita, recusa de edição de origem
  automática, reprocessamento sem segundo lançamento, trava de origem após
  cancelamento, configuração desligada sem apagar nem reconstruir, isolamento
  entre organizações, unidade cruzada recusada, resumo separando realizado de
  previsto, série mensal, distribuição por categoria e período invertido.
