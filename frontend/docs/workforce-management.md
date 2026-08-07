# Workforce Management

Gestão da equipe — pessoas, papéis, convites e carga de trabalho.

|            |                          |
| ---------- | ------------------------ |
| Rota       | `/equipe`                |
| Permissão  | `organization.read`      |
| Registries | Entity · Action · Metric |

---

## 1. Não substitui autenticação

Aqui não há login, sessão, MFA nem troca de senha. `identity/me` e
`identity/sessions` continuam sendo do domínio de autenticação, e cada pessoa
administra o próprio perfil.

Este módulo é **gestão operacional**: quem faz parte, com que papel, em que
unidade, e o que cada um tem para fazer.

## 2. Stage 0 — o que existia

| Recurso                                                 | Situação                        |
| ------------------------------------------------------- | ------------------------------- |
| `GET /organizations/current/members`                    | existia, com papel e situação   |
| `POST /identity/invitations`                            | existia — só criar              |
| `POST /identity/invitations/accept`                     | existia                         |
| `operations?assignedUserId=`                            | **existia** — filtro real       |
| `artifact-executions?responsibleUserId=`                | **existia** — filtro real       |
| `scheduling/events?userId=`                             | **existia** — filtro real       |
| Analytics `technicians.active` / `.assignment_coverage` | **existia** — indicadores reais |

Os três filtros por pessoa e os dois indicadores de técnico sustentam a aba
Técnicos inteira sem nada novo.

**Quatro lacunas bloqueavam abas completas**, todas verificadas com 404:

```
GET    /identity/invitations         404   → a aba Convites não podia existir
POST   /identity/invitations/:id/resend  404
DELETE /identity/invitations/:id     404
GET    /roles /permissions /modules  404   → a aba Papéis não podia existir
members[] sem businessUnits                → "visualizar unidade" impossível
```

## 3. As alterações de backend, e por quê

Cinco adições, **todas puramente aditivas**: nenhum modelo novo, nenhuma
migração, nenhum contrato existente alterado. Todas sobre dados que já estavam
no banco.

| Adição                                  | Justificativa                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /identity/invitations`             | sem listar, a aba Convites não existe. Leitura no mesmo escopo de quem já pode convidar |
| `POST /identity/invitations/:id/resend` | reenviar é pedido explícito do Stage 1                                                  |
| `DELETE /identity/invitations/:id`      | cancelar é pedido explícito; grava `REVOKED`, não apaga                                 |
| `GET /organizations/current/roles`      | sem papéis, a aba Papéis não existe. Leitura pura                                       |
| `businessUnits` no membro               | `BusinessUnitMembership` já existia e nunca era publicada                               |

Mais dois literais formalizando valores que o código já usava em texto:
`InvitationStatus` e (da PR-16) o padrão de `status`.

### O token nunca é publicado

`InvitationReadModels` existe exatamente para tornar essa omissão explícita: um
`select` esquecido no repositório não vaza para a resposta. Nem o token em
claro, nem o `tokenHash`. Verificado: `token exposto? False`.

Reenviar **gera token novo** — o link anterior deixa de valer. Se o convite foi
reenviado, é porque o primeiro não chegou ou não devia mais valer.

### Só convite pendente aceita ação

`requirePending` no servidor. Verificado:

```
reenviar cancelado  400 · Invitation is revoked and cannot be changed
```

A tela reflete a mesma condição em vez de oferecer um botão que voltaria 400.

### Papéis: só os da organização

A primeira versão da consulta incluía papéis globais e `PLATFORM_ADMIN` vazava
para todo tenant — um papel que o gestor não pode conceder e que não descreve
ninguém da equipe dele. Corrigido antes de seguir. Verificado:
`papéis do tenant: ['OWNER']`.

## 4. As abas

| Aba              | Fonte                                | Conteúdo                                                               |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| **Usuários**     | `GET /organizations/current/members` | listar, buscar, filtrar, detalhe, papel, unidades, permissões efetivas |
| **Técnicos**     | membros + os três filtros por pessoa | carga de trabalho de cada um                                           |
| **Convites**     | `GET /identity/invitations`          | listar, reenviar, cancelar, situação, prazo                            |
| **Papéis**       | `GET /organizations/current/roles`   | permissões por módulo, capabilities do plano                           |
| **Inteligência** | —                                    | ausência declarada (§7)                                                |

Cada aba tem `TabBoundary` próprio.

### Busca e filtros são locais — e a tela diz isso

`GET /organizations/current/members` **não é paginado e não aceita
parâmetros**: devolve a organização inteira, ordenada por nome. Filtrar aqui é
recortar uma lista que já está inteira na mão — não é substituir um filtro de
servidor nem paginar no cliente o que o servidor pagina.

Convites filtram por `status` **no servidor** (`InvitationQueryDto`); a busca
por e-mail é local, pelo mesmo motivo.

Quando os endpoints aceitarem consulta, o `useListController` já está no lugar
para passá-la adiante.

### Permissões efetivas

Vêm do **papel**, que `GET /organizations/current/roles` publica com a lista
`permissions`. É o mesmo dado que o backend usa para autorizar, exibido —
nenhuma permissão é derivada ou inferida.

### Permissão e capability são coisas diferentes

- **Permissão** vem do papel: o que esta pessoa pode fazer.
- **Capability** vem do plano: o que esta organização contratou.

O backend exige as duas, e é por isso que um Owner pode não ver um recurso — o
papel permite, o plano não inclui. A aba Papéis mostra as duas lado a lado
justamente para tornar isso visível.

### Quem é "técnico"

O backend **não tem esse conceito**: não há flag, especialidade nem tipo de
pessoa. O que existe é papel, e é ele que a aba usa — com filtro por papel para
recortar a equipe de campo.

Inventar uma regra de "quem é técnico" pelo nome do papel criaria uma
classificação que o servidor não reconhece e que quebraria no primeiro papel
renomeado.

## 5. Carga, não produtividade

Cada número por pessoa é `meta.total` de uma consulta filtrada por
`assignedUserId` ou `responsibleUserId` — contagem do servidor.

**Não é produtividade.** O Analytics publica `technicians.active` e
`technicians.assignment_coverage`, ambos da **organização**; não há indicador
por pessoa em contrato nenhum. Carga é quanto há para fazer; produtividade
seria quanto se fez por tempo, e isso ninguém mediu.

Um indicador de desempenho inventado é a pior classe de número inventado —
alguém decide sobre pessoas com ele.

## 6. KPIs

Duas origens, e a diferença importa:

| Indicador                         | Origem                                                |
| --------------------------------- | ----------------------------------------------------- |
| `technicians.active`              | **Analytics** — `OBSERVED`, com direção e procedência |
| `technicians.assignment_coverage` | **Analytics** — `DERIVED`, unidade `%`                |
| `team.members.total`              | tamanho da lista de membros                           |
| `team.invitations.pending`        | tamanho da lista de convites pendentes                |

Os dois últimos só são legítimos porque a resposta **é** a coleção completa —
esses endpoints não paginam. Contar uma página e chamar de total seria outra
coisa, e a tela declara a diferença.

"Técnicos em campo agora" não existe: exigiria presença em tempo real.

## 7. Lacunas do backend

| Lacuna                                                | O que a tela faz                                                |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Sem `PATCH` de membro                                 | ação declarada indisponível com motivo                          |
| Sem escrita da situação da associação                 | idem — a coluna é publicada, nenhuma rota a escreve             |
| Sem troca de papel                                    | idem — `roleId` só é informado no convite                       |
| Sem edição de papéis                                  | a aba é somente leitura, como o Stage 1 pede                    |
| Sem produtividade por pessoa                          | mostra carga, e declara a diferença                             |
| Sem disponibilidade em tempo real                     | `scheduling/availability` responde por janela, não por presença |
| Sem IA por pessoa (`userId` → 400)                    | aba declara a ausência                                          |
| Sem especialidades, certificações, equipes ou escalas | não existem em contrato                                         |
| Membros e convites sem paginação                      | busca e filtro locais, declarados na tela                       |

## 8. Endpoints utilizados

| Endpoint                                      | Uso                                                |
| --------------------------------------------- | -------------------------------------------------- |
| `GET /organizations/current/members`          | abas Usuários e Técnicos · KPI de pessoas          |
| `GET /organizations/current/roles`            | aba Papéis · filtro de papel · permissões efetivas |
| `GET /identity/invitations`                   | aba Convites · KPI de pendentes                    |
| `POST /identity/invitations`                  | convidar                                           |
| `POST /identity/invitations/:id/resend`       | reenviar                                           |
| `DELETE /identity/invitations/:id`            | cancelar                                           |
| `GET /operations?assignedUserId=`             | operações atribuídas · carga                       |
| `GET /artifact-executions?responsibleUserId=` | execuções · carga                                  |
| `GET /scheduling/events?userId=`              | agenda da pessoa                                   |
| `GET /analytics/kpis`                         | `technicians.active` e `.assignment_coverage`      |

## 9. Integrações

| Módulo                     | Como                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Operations**             | operações atribuídas no detalhe; "ver todas" leva a `/operacoes?assignedUserId=`   |
| **Scheduling**             | próximos 30 dias da pessoa, com ocorrências expandidas pelo servidor               |
| **Artifact Executions**    | execuções sob responsabilidade; "ver todas" leva a `/execucoes?responsibleUserId=` |
| **Organization Workspace** | mesma consulta de membros, mesma key — uma requisição para as duas telas           |
| **Dashboard**              | mesmos indicadores de técnico, do mesmo `GET /analytics/kpis`                      |

Nenhuma rota é montada à mão: `entityHref` e `ROUTES` resolvem tudo.

## 10. Evoluções já preparadas

O que a arquitetura evita acoplar, e o que falta no backend:

| Evolução                          | O que já está no lugar                                    | O que falta                       |
| --------------------------------- | --------------------------------------------------------- | --------------------------------- |
| **Especialidades técnicas**       | a pessoa é uma entidade (`team-member`) com um service só | sem coluna nem tabela             |
| **Certificações**                 | idem — seria um sub-recurso do membro                     | sem modelo                        |
| **Disponibilidade em tempo real** | `scheduling/availability` já é consumido por janela       | sem presença/sessão de campo      |
| **Equipes**                       | `businessUnits` já agrupa pessoas por unidade             | sem modelo de equipe              |
| **Escalas**                       | a agenda por pessoa já existe                             | sem modelo de turno               |
| **Produtividade avançada**        | o Metric Registry já separa carga de produtividade        | sem tempo por tarefa              |
| **Geolocalização**                | —                                                         | sem coordenada em nenhum contrato |

Cada uma delas entra como aba ou seção nova consumindo o mesmo service — sem
tipo paralelo, sem segunda consulta de membros.

## 11. Nenhuma regra de negócio no frontend

- não decide se um convite ainda vale — o servidor marca `EXPIRED` ao listar;
- não classifica ninguém como técnico;
- não calcula produtividade;
- não deriva permissões — exibe as que o papel publica;
- não pré-verifica convite duplicado — o `@@unique` é do banco, o 409 é do servidor;
- não decide quem pode reenviar ou cancelar — `requirePending` é do servidor;
- não gera token nem prazo;
- não autoriza — permissões e capabilities são as que o backend exige.
