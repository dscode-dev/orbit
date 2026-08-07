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

## 4. Carga, não produtividade

Cada número por pessoa é `meta.total` de uma consulta filtrada por
`assignedUserId` ou `responsibleUserId` — contagem do servidor.

**Não é produtividade.** O Analytics publica `technicians.active` e
`technicians.assignment_coverage`, ambos da **organização**; não há indicador
por pessoa em contrato nenhum. Carga é quanto há para fazer; produtividade
seria quanto se fez por tempo, e isso ninguém mediu.

Um indicador de desempenho inventado é a pior classe de número inventado —
alguém decide sobre pessoas com ele.

## 5. KPIs

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

## 6. O que a PR-18 acrescentou

As lacunas que a PR-17 declarou foram fechadas — exceto as que continuam sendo
ausências legítimas (§6.3).

### 6.1 Fase A — sem migração

| Adição                        | Contrato                                                          |
| ----------------------------- | ----------------------------------------------------------------- |
| Editar membro                 | `PATCH /organizations/current/members/:userId` — papel e situação |
| CRUD de papéis                | `POST/PATCH/DELETE /organizations/current/roles`                  |
| Paginação de membros          | `MemberQueryDto` (`page`, `limit`)                                |
| Paginação e busca de convites | `InvitationQueryDto` (`status`, `search`, `page`, `limit`)        |

**Escalas não precisaram de nada.** `SchedulingAvailability` já tinha tipo, dia
da semana ou data, horário, fuso e vigência — e endpoints. É o que o motor de
agenda consulta ao detectar conflito; um modelo paralelo divergiria na primeira
folga cadastrada só num deles.

### 6.2 Fase B — domínio novo

Uma migração (`20260807210000_pr18_workforce_domain`), seis modelos, RLS por
organização em todos:

| Modelo                          | Para quê                                              |
| ------------------------------- | ----------------------------------------------------- |
| `Specialty` · `MemberSpecialty` | catálogo e vínculo, com nível **declarado**           |
| `MemberCertification`           | habilitação com vencimento, e `fileId` para o Storage |
| `Team` · `TeamMembership`       | equipes, com líder e unidade opcionais                |
| `MemberLocation`                | posição reportada pela própria pessoa                 |

Capabilities `workforce.read` e `workforce.manage`, concedidas aos planos
existentes — nenhum plano novo.

Especialidade é **catálogo**, e não texto livre no membro, para que duas
pessoas com a mesma especialidade sejam encontráveis pela mesma chave — sem
isso, "Refrigeração" e "refrigeraçao" seriam coisas diferentes.

### 6.3 O que continua não existindo

| Lacuna                                | O que a tela faz                                                            |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Edição de perfil por terceiro         | `PATCH` de membro muda papel e situação; nome e e-mail são de `identity/me` |
| Produtividade por pessoa              | mostra carga, e declara a diferença                                         |
| Presença em tempo real                | mostra a última posição **reportada**, com a idade junto                    |
| IA por pessoa (`userId` → 400)        | aba declara a ausência                                                      |
| Edição de papéis de sistema           | `isSystem` os protege; o servidor recusa                                    |
| Busca e filtro de membros no servidor | recortam a página carregada, e a tela diz isso                              |

## 7. As abas

| Aba                | Fonte                                                 |
| ------------------ | ----------------------------------------------------- |
| **Usuários**       | membros paginados · papel, unidades, situação, edição |
| **Técnicos**       | membros + carga por pessoa                            |
| **Equipes**        | `GET /workforce/teams`                                |
| **Especialidades** | `GET /workforce/specialties`                          |
| **Certificações**  | `GET /workforce/certifications`                       |
| **Escalas**        | `GET /scheduling/availability`                        |
| **Localização**    | `GET /workforce/locations`                            |
| **Convites**       | `GET /identity/invitations`                           |
| **Papéis**         | `GET /organizations/current/roles`                    |
| **Inteligência**   | ausência declarada                                    |

## 8. Endpoints utilizados

| Endpoint                                             | Uso                                           |
| ---------------------------------------------------- | --------------------------------------------- |
| `GET /organizations/current/members`                 | Usuários e Técnicos · KPI de pessoas          |
| `PATCH /organizations/current/members/:userId`       | papel e situação                              |
| `GET /organizations/current/roles`                   | Papéis · filtros · permissões efetivas        |
| `POST/PATCH/DELETE /organizations/current/roles`     | CRUD de papéis                                |
| `GET /identity/invitations`                          | Convites · KPI de pendentes                   |
| `POST /identity/invitations`                         | convidar                                      |
| `POST /identity/invitations/:id/resend`              | reenviar                                      |
| `DELETE /identity/invitations/:id`                   | cancelar                                      |
| `GET/POST/PATCH/DELETE /workforce/specialties`       | catálogo                                      |
| `GET /workforce/members/specialties`                 | especialidades por pessoa                     |
| `POST/DELETE /workforce/members/:userId/specialties` | vincular e desvincular                        |
| `GET /workforce/certifications`                      | alerta de vencimento                          |
| `POST /workforce/members/:userId/certifications`     | registrar habilitação                         |
| `PATCH/DELETE /workforce/certifications/:id`         | editar e remover                              |
| `GET/POST/PATCH/DELETE /workforce/teams`             | equipes                                       |
| `POST/DELETE /workforce/teams/:id/members`           | composição                                    |
| `POST /workforce/me/location`                        | a pessoa reporta a **própria** posição        |
| `GET /workforce/locations`                           | últimas posições da equipe                    |
| `GET/POST/DELETE /scheduling/availability`           | escalas — já existia                          |
| `GET /operations?assignedUserId=`                    | operações atribuídas · carga                  |
| `GET /artifact-executions?responsibleUserId=`        | execuções · carga                             |
| `GET /scheduling/events?userId=`                     | agenda da pessoa                              |
| `GET /analytics/kpis`                                | `technicians.active` e `.assignment_coverage` |

### Decisões que o servidor toma, e a tela não

| Decisão                                     | Resposta                                             |
| ------------------------------------------- | ---------------------------------------------------- |
| O dono não é alterado                       | `400 The organization owner cannot be modified here` |
| Papel de sistema não se edita               | `400 System roles cannot be modified`                |
| Papel com membro ou convite não se remove   | `409 Role still has members or pending invitations`  |
| Especialidade vinculada não se remove       | `409 Specialty is still assigned to team members`    |
| Certificação não vence antes de ser emitida | `400 expiresAt must be after issuedAt`               |
| Posição não vem do futuro                   | `400 recordedAt cannot be in the future`             |
| Vencimento de habilitação                   | `expiryStatus` e `daysUntilExpiry` no Read Model     |

## 9. Integrações

| Módulo                     | Como                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| **Operations**             | operações atribuídas; "ver todas" leva a `/operacoes?assignedUserId=` |
| **Scheduling**             | agenda da pessoa **e** escalas, do mesmo `SchedulingAvailability`     |
| **Artifact Executions**    | execuções sob responsabilidade                                        |
| **Organization Workspace** | mesma consulta de membros, mesma key                                  |
| **Dashboard**              | mesmos indicadores de técnico                                         |
| **Storage (PR-19)**        | `MemberCertification.fileId` aponta para o arquivo do certificado     |

Nenhuma rota é montada à mão: `entityHref` e `ROUTES` resolvem tudo.

## 10. Duas decisões que merecem nome

### O vencimento é do servidor

`expiryStatus` e `daysUntilExpiry` chegam calculados. A tela **não compara
datas** para decidir se alguém está habilitado: um navegador com relógio errado
transformaria um técnico vencido em habilitado, e habilitação é exatamente o
tipo de coisa que não pode depender do relógio de quem olha.

### Ninguém é rastreado

`POST /workforce/me/location` não aceita `userId` — quem reporta é quem está
autenticado. Publicar a posição de outro seria vigilância por procuração.

A aba se chama **Localização**, e o texto é literal: é a última posição
_reportada_, com a idade junto. Quem não aparece não reportou — pode estar sem
sinal, com o aplicativo fechado ou de folga. Silêncio não é ausência, e a tela
diz isso em vez de deixar uma lista vazia sugerir que ninguém está trabalhando.

Sem mapa embutido: exigiria um provedor externo e uma chave a gerenciar para
responder a mesma pergunta que coordenada, precisão e um link resolvem.

### Evoluções ainda em aberto

| Evolução                 | O que falta                                      |
| ------------------------ | ------------------------------------------------ |
| Produtividade avançada   | tempo gasto por tarefa                           |
| Presença em tempo real   | sessão de campo ou heartbeat                     |
| Histórico de trajeto     | `MemberLocation` guarda; falta endpoint de série |
| Certificado como arquivo | upload pela tela (o `fileId` já existe)          |
| Escala por equipe        | janela é por pessoa                              |
| IA sobre a equipe        | `AiExecutionQueryDto` não aceita `userId`        |

## 11. Nenhuma regra de negócio no frontend

- não decide se um convite ainda vale — o servidor marca `EXPIRED` ao listar;
- não decide se uma certificação está válida — `expiryStatus` vem calculado;
- não gera `slug` de especialidade, equipe ou papel — todos do servidor;
- não decide quem pode editar papel de sistema nem remover papel em uso;
- não classifica ninguém como técnico;
- não calcula produtividade;
- não deriva permissões — exibe as que o papel publica;
- não pré-verifica convite duplicado — o `@@unique` é do banco, o 409 é do servidor;
- não decide quem pode reenviar ou cancelar — `requirePending` é do servidor;
- não gera token nem prazo;
- não autoriza — permissões e capabilities são as que o backend exige.
