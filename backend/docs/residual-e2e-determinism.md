# PR-26.6.3 — determinismo E2E e request pipeline

## Resultado

O gate completo foi executado dez vezes, sequencialmente, com `orbit_app`, sem
retry e sem `--forceExit`. As dez execuções passaram: 11 suítes e 152 testes por
execução (1.520 testes). Em todas elas os contadores de transação expirada,
cross-tenant leak, capability leak e timeout de teardown permaneceram em zero.

O gate dedicado também passou 22/22 testes (19 de RLS e 3 de concorrência).
Nenhuma policy, role, migration, capability ou arquitetura de transação RLS foi
alterada nesta PR.

## A — conclusão de PMOC

O fluxo completo `plan → coverage → activation → execution → operation →
completion` ganhou uma repetição de 20 ciclos no mesmo teste. Cada estágio usa
correlation ID estável. As leituras que podem produzir ausência agora registram,
dentro da própria `RlsTransaction`, a entidade e o ID procurados, ator, tenant e
unidades esperados, além de `current_user` e dos GUCs efetivos de organização,
unidades e ator. Não existe lookup privilegiado ou segunda leitura sem RLS.

O 404 histórico não voltou a ocorrer com essa instrumentação: foram 20/20
ciclos direcionados, 10/10 suítes completas e 0 `pmoc-not-found` espúrio. Logo,
não há evidência honesta para atribuí-lo retroativamente a `PmocPlan`,
`PmocExecution` ou `Operation`; o teste antigo não preservava envelope,
correlation ID ou log interno. A investigação encontrou duas fontes de
nondeterminismo do harness capazes de afetar a mesma execução completa:

- o Supertest recebia um `http.Server` não escutando e criava/fechava sockets
  implicitamente; sob carga foram reproduzidos `ECONNRESET` e
  `Expected HTTP/`;
- a API de desenvolvimento e o Jest usavam o mesmo banco, permitindo que o
  worker externo reivindicasse jobs das fixtures.

O harness agora usa `app.listen(0, '127.0.0.1')`, a API externa é excluída do
gate e cada arquivo remove apenas seus tenants de fixture antes e depois. O
worker automático fica desligado no ambiente E2E; testes de jobs o dirigem por
`tick()`. Assim, o estado assíncrono pertence a uma única suíte. A telemetria
nova torna obrigatoriamente identificável a entidade caso um 404 de domínio
volte a existir, sem inventar uma causa para uma ocorrência sem rastro.

## B — ArtifactExecution sem credencial

Controller, metadata, guards globais e `ValidationPipe` estavam corretos. O 400
residual não era produzido pelo DTO: a causa foi o servidor HTTP não escutando
entregue ao Supertest. A abertura/fechamento implícito do socket sob concorrência
permitia falhar antes de middleware e guards; por isso a resposta antiga também
não continha o envelope nem correlation ID do Orbit.

Um teste isolado da pipeline usa servidor realmente ligado e cobre, inclusive
sob 80 requests concorrentes:

- sem token + payload inválido → 401;
- token inválido + payload inválido → 401;
- token válido + payload inválido → 400;
- token válido + sem capability → 403.

Isso prova que autenticação e autorização precedem a validação do payload na
rota protegida. Nenhuma semântica de autenticação foi relaxada.

## C — teardown de Inventory

O `BackgroundJobWorker` limpava o `setInterval`, mas não aguardava o `tick()` já
em andamento. O Nest podia então iniciar o fechamento do Prisma enquanto o job
ainda usava o pool. O worker agora mantém a Promise do ciclo ativo; no destroy,
impede novas reivindicações, limpa o timer, aguarda o trabalho em curso e só
então permite que os demais providers fechem.

O teste unitário usa uma claim bloqueada para provar essa ordem. Inventory
passou 16/16 com `--detectOpenHandles` e com o timeout padrão de 5 segundos; o
aumento temporário do timeout foi removido. O gate 10× encerrou sem
`--forceExit` e sem timeout de hook.

## Isolamento e filas

Jobs são globais por projeto no PostgreSQL. Portanto, limpar apenas no fim da
execução Jest não isolava arquivos: um `worker.tick()` da suíte seguinte podia
consumir um job deixado pela anterior. O `OrbitE2eEnvironment` executa cleanup
tenant-scoped em ambos os lados de cada arquivo. A limpeza seleciona somente os
prefixos de e-mail reservados às fixtures e depende de cascade da organização;
não usa `TRUNCATE`, data de criação ou nome genérico.

Uma falha permanente adicional foi explicitada durante o stress: timezone
inválido de relatório chega como Prisma `P2010`, SQLSTATE `22023`. Esse input é
marcado `PermanentJobError`, preservando a causa no log, e não retorna à fila
cinco segundos depois para roubar o tick de outro relatório. Falhas de conexão
e infraestrutura continuam transitórias. O classificador é estrutural porque
`instanceof` não é estável entre cópias do runtime Prisma no Jest.

## Como reproduzir

Com `DATABASE_URL` administrativo, `APP_DATABASE_URL` de `orbit_app` e
`DATABASE_ENFORCE_RESTRICTED_ROLE=true`:

```bash
node scripts/run-pr-26-6-2-e2e-gate.mjs 10
```

O runner imprime por rodada: exit code, duração, suítes, testes, transações
expiradas, vazamentos cross-tenant/capability e timeouts de teardown. Uma falha
é reportada integralmente e não é repetida.

## Evidência final

| Gate                                                | Resultado          |
| --------------------------------------------------- | ------------------ |
| Resíduos combinados (App, Inventory, Reports, PMOC) | 67/67              |
| Suite completa, rodada de controle                  | 152/152            |
| Suite completa 10×                                  | 10/10; 1.520/1.520 |
| RLS + concorrência                                  | 22/22              |
| Expired transaction                                 | 0                  |
| Cross-tenant leak                                   | 0                  |
| Capability leak                                     | 0                  |
| Teardown timeout                                    | 0                  |
