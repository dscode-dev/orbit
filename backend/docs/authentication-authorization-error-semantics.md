# Semântica de erros de autenticação e autorização (PR-26.6.2)

## Contrato

| Situação comprovada                                                            | HTTP |
| ------------------------------------------------------------------------------ | ---: |
| token ausente, inválido ou expirado; sessão ausente, expirada ou revogada      |  401 |
| ator autenticado e política, role, capability ou plano negou a ação            |  403 |
| consulta concluída sob contexto RLS válido e recurso ausente/invisível         |  404 |
| banco indisponível, pool/timeout, transação, conexão/socket ou erro inesperado |  5xx |

Falhar fechado não significa declarar uma negação de autorização: se a fonte de
autoridade não pôde ser consultada, o acesso continua bloqueado, porém a causa
segue para o pipeline como erro interno.

## Caminho da exceção

O `JwtAuthenticationGuard` traduz somente erros produzidos pela validação do
token e estados semânticos da sessão. Exceções do repositório, pool, socket ou
adapter são registradas e relançadas sem conversão. Os guards de plano e
capability também preservam falhas de lookup; `ForbiddenException` só nasce
depois que os entitlements foram obtidos e a política efetivamente recusou.

`SubscriptionPlanRepository` aplica os três GUCs usados pelo lookup em uma
única projeção `set_config`, dentro da transação. Quando a organização não é
visível, uma sonda na **mesma transação** diferencia contexto válido de contexto
ausente/divergente. Não existe consulta privilegiada nem fallback sem RLS:

- contexto válido + ausência: o serviço mantém o 404 contratual;
- contexto ausente/divergente ou falha da sonda: 5xx.

## Classificação e observabilidade

O classificador central reconhece somente categorias úteis para esta fronteira:
`DATABASE_UNAVAILABLE`, `DATABASE_TIMEOUT`, `TRANSACTION_FAILURE`,
`CONNECTION_FAILURE` e `INTERNAL_ERROR`. Ele considera códigos conhecidos do
Prisma/PostgreSQL/Node e a cadeia de `cause`; não tenta transformar toda exceção
possível em catálogo público.

O request ID é estabelecido por middleware antes dos guards. Falhas internas
geram log estruturado com request/correlation ID, guard ou estágio, endpoint,
ator e organização quando já resolvidos, categoria, classe e código. A stack e
a causa ficam somente no log. O cliente recebe mensagem genérica, timestamp e
correlation ID; token, headers, SQL, credenciais, stack e detalhes do banco não
são publicados.

A memoização de entitlement usa um `Symbol` no objeto Express da request e
armazena a `Promise` apenas durante aquele ciclo de vida. Uma rejeição pode ser
compartilhada pelos guards da mesma request, mas nunca por outra request; não há
cache global.

## Auditoria direcionada

- `JwtAuthenticationGuard`: removida a captura genérica que convertia toda
  exceção em 401.
- guards de plano/capability: lookup protegido por logging + rethrow; os guards
  de role/permissão não consultam infraestrutura e não tinham captura genérica.
- `SubscriptionPlanService`: ausência real ainda vira 404; exceção do
  repositório não é convertida.
- `FoundationExceptionFilter`: 5xx genérico externamente e causa classificada
  internamente.
- `RequestContext`: continua isolado por `AsyncLocalStorage`; nenhum GUC ou
  entitlement foi movido para estado global.

## Evidência desta entrega

- unitários direcionados: 5 suítes, 24 testes verdes;
- fault injection E2E: falhas `ECONNRESET` e `P2024` retornaram 500, com causa
  no log, correlation ID na resposta e sem vazamento;
- RLS + concorrência: 22 testes verdes (19 RLS + 3 stress), 336 requests no
  cenário de stress, sem cross-tenant/capability leak;
- gate completo: 10 execuções, 7 verdes e 3 residuais. Portanto o fechamento
  da linha PR-26.6 **não foi atingido**. Ocorrências observadas: PMOC retornou
  404 em uma conclusão (esperado 201), rota v1 sem credencial retornou 400 uma
  vez (esperado 401), e teardown de Inventory excedeu 5 s apesar de seus 150
  testes estarem verdes. Não houve `expired transaction` observado.

| Execução | Total |  Falhas |   Duração | Endpoint/estágio                                      | HTTP | correlationId                              | Categoria observada                             |
| -------: | ----: | ------: | --------: | ----------------------------------------------------- | ---: | ------------------------------------------ | ----------------------------------------------- |
|        1 |   150 |       0 | 145,310 s | —                                                     |    — | —                                          | —                                               |
|        2 |   150 |       0 | 172,146 s | —                                                     |    — | —                                          | —                                               |
|        3 |   150 |       0 | 207,168 s | —                                                     |    — | —                                          | —                                               |
|        4 |   150 |       0 | 245,726 s | —                                                     |    — | —                                          | —                                               |
|        5 |   150 |       1 | 207,248 s | `POST /api/v1/pmoc/plans/:id/executions/:id/complete` |  404 | não emitido pelo relatório antigo do teste | domínio/visibilidade ainda não determinada      |
|        6 |   150 |       0 | 199,276 s | —                                                     |    — | —                                          | —                                               |
|        7 |   150 |       0 | 159,017 s | —                                                     |    — | —                                          | —                                               |
|        8 |   150 |       0 | 146,200 s | —                                                     |    — | —                                          | —                                               |
|        9 |   150 |       1 | 140,960 s | `GET /api/v1/artifact-executions`                     |  400 | não emitido pelo relatório antigo do teste | cliente inesperado, causa ainda não determinada |
|       10 |   150 | 1 suíte | 148,142 s | teardown de Inventory                                 |  n/a | n/a                                        | timeout de encerramento do harness              |

Os dois correlation IDs ausentes são uma limitação da asserção anterior do
Supertest, não valores inferidos. O teste agora fixa IDs distintos nas rotas
legada/v1 e inclui status + envelope na falha. O teste isolado de PMOC passou
18/18 após o gate; isso não substitui nem reclassifica a falha da execução 5.
O baseline histórico usado foi o relatório comprovado da PR-26.6.1 (5/10,
Inventory 401, Financial/Reports/PMOC 404 e `socket hang up`). Tentativas locais
anteriores ao gate que não alcançaram o PostgreSQL foram excluídas do resultado.

As falhas residuais não justificam retry nem ampliação de policy. As asserções
de autenticação agora preservam body e correlation ID, e o teardown de
Inventory possui janela explícita de 30 s para fechar recursos já concluídos.

## Dívida formal: PDF e event loop

O rendering PDF síncrono permanece no processo HTTP e pode bloquear o event
loop por dezenas de segundos. Endpoints concorrentes coexistem funcionalmente,
mas ficam sujeitos a latência, conexões abortadas e encerramento lento do test
harness. Esta PR não cria worker/thread/processo. Até a futura isolação, duração
e status de requests, correlation ID e erros de socket/transação são as
superfícies de diagnóstico. O `socket hang up` original não reapareceu com
correlation suficiente neste gate; a nova instrumentação preservará sua causa
na próxima ocorrência.

## Garantias de segurança

Nenhuma migration, policy, role, capability ou regra RLS foi modificada. Não
foram adicionados retry, bypass, consulta administrativa de fallback ou caminho
que conceda acesso quando a autorização não pode ser provada.

## Fechamento na PR-26.6.3

O resultado 7/10 acima é o registro histórico desta entrega, não o estado
atual. A investigação e o fechamento dos três resíduos estão documentados em
[`residual-e2e-determinism.md`](./residual-e2e-determinism.md). O gate sucessor
passou 10/10 execuções completas (1.520/1.520 testes), sem `forceExit`, retries,
transações expiradas, vazamentos de tenant/capability ou timeout de teardown.
