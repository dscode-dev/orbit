# API v1 e contratos públicos

## Versionamento

O Orbit usa versionamento URI nativo do NestJS. A versão estável atual é:

```text
/api/v1
```

Durante a janela de compatibilidade, cada controller é publicado em duas
versões pelo `defaultVersion`: `VERSION_NEUTRAL` preserva a rota legada e `1`
publica a rota oficial. A configuração única está em `src/configure-api.ts` e
é aplicada tanto pelo bootstrap quanto pelos testes HTTP.

Exemplos equivalentes durante a transição:

```text
POST /identity/login
POST /api/v1/identity/login

GET /operations
GET /api/v1/operations
```

### Remoção futura das rotas legadas

1. Web e Flutter passam a apontar para a base `/api/v1`.
2. Telemetria deve distinguir tráfego legado e versionado no gateway.
3. A rota legada recebe cabeçalhos de depreciação e uma data de encerramento.
4. Após a janela mínima suportada do aplicativo mobile e ausência de tráfego
   relevante, remove-se `VERSION_NEUTRAL` do `defaultVersion`.
5. Mudanças incompatíveis futuras são publicadas em `/api/v2`; a v1 não muda
   de forma destrutiva.

Nenhuma rota foi removida nesta PR.

## Read Models públicos

| Read Model                       | Endpoint principal                      | Responsabilidade                                        |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `IdentitySessionReadModel`       | login, cadastro e refresh               | Par de tokens público, sem hash ou estado da credencial |
| `IdentityProfileReadModel`       | `/identity/me`                          | Perfil sem campos internos de autenticação              |
| `IdentityDeviceSessionReadModel` | `/identity/me/sessions`                 | Sessões revogáveis sem hash do refresh token            |
| `OrganizationContextReadModel`   | `/organizations/current`                | Organização, plano e unidades do contexto ativo         |
| `BusinessUnitReadModel`          | `/organizations/current/business-units` | Unidade pública sem soft-delete ou metadados internos   |
| `OperationListItemReadModel`     | `/operations`                           | Item estável da listagem paginada                       |
| `OperationDetailsReadModel`      | `/operations/:id` e mutações            | Detalhe compatível consumido pelos clientes             |
| `OperationTimelineReadModel`     | `/operations/:id/timeline`              | Histórico e anexos ordenados                            |
| `OperationHistoryReadModel`      | `/operations/:id/history`               | Evento público de auditoria operacional                 |
| `OperationAssignmentReadModel`   | detalhe da operação                     | Atribuição e referência pública do usuário              |

Datas são publicadas como ISO 8601. Valores `Decimal` de planos continuam
serializados como `string | number | null`, preservando o contrato existente.
Campos JSON de negócio permanecem `unknown`; não passam a expor estruturas do
Prisma por isso.

## Camada de mapeamento

Os mappers ficam junto à fronteira de cada módulo:

- `identity/identity.mapper.ts`;
- `organizations/organization.mapper.ts`;
- `operations/operation.mapper.ts`.

Controllers recebem os mappers por injeção e nunca retornam o resultado dos
repositories diretamente. Serviços continuam executando exatamente as mesmas
regras e transações. Os mappers fazem somente seleção, normalização de datas e
composição do contrato público.

Exemplos de diferenças deliberadas:

| Estrutura interna                                | Contrato público  |
| ------------------------------------------------ | ----------------- |
| `Credential.passwordHash`, tentativas e bloqueio | nunca publicados  |
| `User.normalizedEmail`, `deletedAt`              | nunca publicados  |
| `Session.refreshTokenHash`                       | nunca publicado   |
| `OperationAttachment.storageKey`, `deletedAt`    | nunca publicados  |
| `BusinessUnit.deletedAt`                         | nunca publicado   |
| `Date` do Prisma                                 | `string` ISO 8601 |

## Endpoints disponíveis em `/api/v1`

O versionamento é global e cobre todos os controllers atuais. Os namespaces
publicados são:

- `/api/v1/identity/**`;
- `/api/v1/organizations/**` e `/api/v1/plans`;
- `/api/v1/operations/**` e `/api/v1/checklist-executions/**`;
- `/api/v1/customers/**`, catálogos, ativos e integrações;
- `/api/v1/report-templates/**`, relatórios e assinaturas;
- `/api/v1/notifications/**` e `/api/v1/ai-executions/**`;
- `/api/v1/dashboard/**`, `/api/v1/analytics/**` e `/api/v1/scheduling/**`;
- `/api/v1/platform/**` para administração global.

Autenticação, guards, permissões, capabilities e RLS são os mesmos das rotas
legadas.

## Como publicar um novo contrato

1. Crie `<module>.read-models.ts` com TypeScript puro, sem imports de Prisma,
   NestJS ou decorators.
2. Crie um mapper injetável que aceite uma forma estrutural interna e devolva
   somente o Read Model.
3. Mapeie no controller; não mova apresentação para repository nem regra de
   negócio para o mapper.
4. Teste seleção de campos, nulos, datas e ausência de dados sensíveis.
5. Adicione o arquivo a `frontend/scripts/sync-contracts.mjs`.
6. Atualize o parser imutável e tolerante do Flutter para o recorte consumido.
7. Registre endpoint e consumidores no Orbit Contracts Manifest.

Adicionar campo deve ser compatível e preferencialmente opcional. Remover,
renomear ou mudar tipo exige uma nova versão da API.
