# PR-26.8 — PMOC & Automation Integrity

## PMOC

A janela parcial era concreta: `activate()` mudava `pmoc_plans.status` para
`ACTIVE` numa `RlsTransaction`; depois `openCycle()` tentava inserir o primeiro
ciclo em outra. Falha entre as chamadas deixava `ACTIVE + zero ciclo`. O
`ON CONFLICT DO NOTHING` existente também não tinha uma constraint de identidade
por plano/vencimento que impedisse duas inserções concorrentes.

O novo boundary transacional contém:

- claim da transição DRAFT/SUSPENDED → ACTIVE;
- definição de `nextDueOn`;
- criação/garantia do `PmocExecution` correspondente;
- audit log e domain event da ativação.

O banco possui `UNIQUE (plan_id, due_on)`. A transação usa
`ON CONFLICT (plan_id, due_on)`, portanto ativações concorrentes convergem para
um ciclo; apenas a requisição que reivindica a transição emite o evento de
domínio. O rollover já concluía execução, atualizava o plano e abria o próximo
ciclo numa transação; agora a mesma constraint também protege sua concorrência.

Scheduling e os dois due jobs são efeitos eventuais e recuperáveis. O ciclo já
é um estado válido sem calendário configurado. A criação/vinculação do evento
usa advisory lock transacional granular por execution, impedindo evento órfão
em reconciliações concorrentes. Jobs usam as chaves
`pmoc:<plan>:<dueOn>:DUE_SOON|OVERDUE`; retry converge para as mesmas linhas.
Repetir `activate` sobre plano já ativo reconcilia esses efeitos sem criar novo
ciclo.

A migration não tenta reparar silenciosamente histórico regulatório: se houver
duplicatas legadas de `(plan_id, due_on)`, a criação do índice falha e exige
auditoria explícita. No gate de aplicação não havia grupos duplicados; nenhum
ciclo precisou ser apagado ou fundido.

## Automation scope

`businessUnitId = null` agora significa “regra organizacional limitada ao
snapshot explícito `scopeBusinessUnitIds`”, não “todas as unidades presentes ou
futuras”. Para ator restrito, o snapshot é exatamente o conjunto do token no
momento da configuração. Para Owner/full-scope, são todas as Business Units
ativas existentes naquele momento. Unidade criada depois não entra
silenciosamente.

Create valida unidade contra o snapshot da request antes do lookup, tornando
same-tenant fora do escopo e cross-tenant indistinguíveis como not-found.
Update ao mudar unidade ou voltar para escopo organizacional recalcula o
snapshot. Duplicate preserva o snapshot; reativação e edição exigem que o ator
atual ainda cubra o snapshot da regra. Perda de membership torna essas operações
fail-closed; execuções já materializadas continuam limitadas pelo snapshot
histórico, não ganham unidades novas.

O dispatcher exige simultaneamente organização, trigger, unidade do evento no
snapshot e escopo do job pai. Para job organizacional ele enfileira a ação com a
interseção entre ambos os conjuntos. O action processor repete a verificação
antes do efeito. `CREATE_REMINDER`, `SEND_NOTIFICATION` e `TRIGGER_JOB` usam a
unidade do evento e/ou `inheritScope`; nenhuma configuração aceita escolher uma
unidade alternativa. Evento da unidade C para regra `[A,B]` é ignorado/`SKIPPED`,
não vira erro de infraestrutura.

## Banco, RLS e performance

A migration adiciona a coluna UUID array `scope_business_unit_ids`, faz
backfill determinístico e cria a unicidade do ciclo. Os índices existentes de
Business Unit e Automation continuam usados; o filtro `has` sobre um conjunto
pequeno ocorre junto de organização/trigger. Locks PMOC são por execution para
Scheduling; não existe lock global. Roles, policies, capabilities, JobScope e
RlsTransaction não foram afrouxados.

Não houve endpoint novo. O DTO de update passou a aceitar `businessUnitId`
UUID ou `null`; Read Models não expõem o snapshot interno.

## Evidência do validation gate

A migration foi aplicada em 2026-08-25 e o segundo `migrate deploy` confirmou
28 migrations e zero pendências. O banco continha seis regras organizacionais
anteriores; todas receberam snapshot não vazio pelo backfill. Nenhuma regra por
unidade ficou com snapshot diferente de `[businessUnitId]`.

Após a suíte E2E, consultas diretas retornaram zero para: plano `ACTIVE` sem
ciclo em `nextDueOn`, grupo duplicado de `(plan_id, due_on)`, vínculo duplicado
de Scheduling, chave PMOC de job duplicada, execução de Automation fora do
snapshot e regra organizacional ativa com snapshot vazio. O papel `orbit_app`
permaneceu `NOSUPERUSER` e `NOBYPASSRLS`, e as tabelas auditadas continuaram
com RLS forçada.

Os resultados executados foram: PMOC 21/21; Automation 17/17; RLS e
concorrência 22/22; E2E completo 155/155; unitários 380/380. Os cenários
concorrentes críticos de ativação/fault foram executados três vezes no total,
sempre convergindo para um único ciclo.
