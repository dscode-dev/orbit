# Configurações & Perfil

Governança da plataforma, e a própria conta.

|            |                                        |
| ---------- | -------------------------------------- |
| Rotas      | `/configuracoes` · `/perfil`           |
| Permissão  | `organization.read` · nenhuma (perfil) |
| Registries | Entity · Action · Workspace Core       |

---

## 1. A fronteira

**Configurações** administram o que vale para toda a organização. **Perfil**
administra o usuário autenticado.

A linha divisória é o `userId`: tudo em `identity/me` é perfil — inclusive as
sessões, que são os dispositivos daquela pessoa. Tudo em
`organizations/current` é configuração.

### A exceção, declarada

**Preferências de notificação** são `@@unique([organizationId, userId, type])`
— pessoais _dentro de_ uma organização. Aparecem em Configurações porque é onde
se administra o canal, e a aba diz de quem elas são: não existe preferência
corporativa, um gestor não decide por e-mail alheio.

### Não é o Workforce Management

Lá se administra a **equipe**: papel, situação, especialidades de outros. Aqui,
só a própria conta. `PATCH /organizations/current/members/:userId` muda papel e
situação de terceiros; `PATCH /identity/me` muda os próprios dados. São dois
contratos, com duas autorizações.

## 2. Stage 0 — quase tudo já existia

| Recurso                                             | Situação                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| `GET/PATCH /identity/me`                            | existia — nome, telefone, `locale`, `timezone` |
| `GET/DELETE /identity/me/sessions`                  | existia                                        |
| **MFA** (`enrollment`, `enable`, `disable`)         | **existia** — nunca consumido                  |
| `GET/PATCH /notifications/preferences`              | existia — nunca consumido                      |
| `GET/PATCH /organizations/current` (com `settings`) | existia                                        |
| `/subscription`, `/usage`, `/business-units`        | existiam                                       |
| `GET/POST/PATCH/DELETE /integrations`               | existia                                        |
| `/scheduling/calendars`                             | existia                                        |
| `GET /artifact-rendering/metrics`                   | existia                                        |

A PR consumiu MFA e preferências de notificação sem criar nenhum contrato para
eles.

## 3. A alteração de backend, e por quê

**Uma só: `POST /identity/me/password`.**

Não havia rota para trocar a própria senha — 404 em `/identity/me/password` e
`/identity/password/change`. O único caminho era a recuperação por e-mail, que
existe para quem **não consegue** entrar.

Pior: a sessão publica `requiresPasswordChange`. A plataforma pedia a troca e
não oferecia onde fazê-la.

| Arquivo                  | Mudança                                     |
| ------------------------ | ------------------------------------------- |
| `identity.dto.ts`        | `ChangePasswordDto` — senha atual + nova    |
| `profile.service.ts`     | verifica a atual com `IHashProvider.verify` |
| `identity.repository.ts` | grava e revoga as demais sessões            |
| `profile.controller.ts`  | `POST /identity/me/password`                |

**Sem migração.** `Credential` já tinha `passwordHash`, `passwordUpdatedAt` e
`mustChangePassword`; o provedor de hash já tinha `verify`.

### As decisões são do servidor

```
senha atual errada   400 · Current password does not match
mesma senha          400 · The new password must be different from the current one
curta demais         400 · newPassword must be longer than or equal to 12 characters
troca válida         204 · sessão atual sobrevive
login com a antiga   401 · Invalid credentials
```

A sessão de quem trocou **sobrevive**; as demais são revogadas. Se a senha
mudou, quem estava com a antiga sai — mas quem acabou de agir não é expulso da
tela.

## 4. Configurações — sete abas

| Aba              | O que administra                                    |
| ---------------- | --------------------------------------------------- |
| **Organização**  | dados, plano, capabilities, unidades, consumo       |
| **Operação**     | autorização de operações atribuídas                 |
| **Agenda**       | calendários                                         |
| **Documentos**   | renderizadores, políticas de emissão, armazenamento |
| **Notificações** | preferências por evento e canal                     |
| **Segurança**    | políticas em vigor e onde cada coisa se administra  |
| **Integrações**  | provedores configurados                             |

### Reusa, não copia

`GeneralSection`, `PlanSection`, `CapabilitiesSection`, `BusinessUnitsSection`,
`IntegrationsSection`, `CalendarSetup` e `OperationAuthorizationSection` são as
mesmas de PRs anteriores. Nenhuma foi reescrita — duas telas para o mesmo
contrato divergiriam no primeiro campo novo.

### Configuração vive junto do que ela configura

Templates, catálogo, equipe e escalas têm Workspace próprio e são
**alcançados** daqui, não duplicados. As abas apontam para lá.

### Operação: um parâmetro, e só

`Organization.settings` é `Json?` **livre** — sem esquema, sem catálogo, sem
validação. A autorização de operações atribuídas (PR-12) grava em
`settings.operations.requireAssignmentAuthorization`, e é a única chave que a
plataforma de fato lê.

A aba **não inventa outros interruptores**. Um botão de "política padrão do
catálogo" gravaria uma chave que nenhum módulo consulta — configuração que não
configura nada é pior que ausência, porque quem a liga acredita ter mudado
algo.

### Consumo: dois contratos lado a lado

`PlanUsageRecord` publica **quanto foi usado**; `entitlements.limits` publica
**quanto é permitido**. A tela os põe lado a lado — não é conta, é
justaposição. Um limite ultrapassado é decisão do backend, que recusa a próxima
criação.

### Segurança: sessão é pessoal

`GET /identity/me/sessions` lista os dispositivos de **quem consulta**. Não há
rota que liste as sessões da organização, e não é descuido: expor os
dispositivos de todo mundo a quem administra a conta é decisão de privacidade
que o backend não tomou.

A aba mostra o que **é** da organização — as políticas que o servidor aplica —
e leva ao Perfil para o que é pessoal. Nenhuma política é configurável:
expiração, tentativas e bloqueio são do servidor e não publicados. O que está
escrito ali descreve o comportamento, não o configura.

## 5. Perfil — quatro abas

| Aba                | Fonte                                |
| ------------------ | ------------------------------------ |
| **Dados pessoais** | `GET/PATCH /identity/me`             |
| **Segurança**      | senha, MFA, sessões                  |
| **Preferências**   | `locale` e `timezone`                |
| **Contexto**       | sessão da aplicação (`GET /session`) |

### Sem exigência de plano

O Perfil não pede capability nem assinatura ativa: a conta é da pessoa, não da
organização. Se o plano vencer, ela ainda precisa poder trocar a própria senha
e encerrar sessões — cobrança da empresa não tranca a segurança de quem
trabalha nela.

### MFA: o segredo aparece uma vez

`POST /mfa/enrollment` gera um **fator novo a cada chamada**. Por isso é
mutação, não consulta: um `useQuery` a dispararia ao montar e trocaria o
segredo debaixo de quem estava no meio do cadastro.

O QR não é desenhado — exigiria uma biblioteca que o Design System não tem. O
segredo em base32 é o que qualquer autenticador aceita digitado, e a URI
`otpauth://` fica visível para quem quiser gerar o código.

### Contexto: trocar de organização não é oferecido

O backend deriva **uma** organização das claims do token e não aceita outra por
requisição. `canSwitchOrganization` responde isso, e a tela declara em vez de
mostrar um seletor que não funcionaria.

Trocar de **unidade** é diferente: é escolha do cliente, viaja como parâmetro
nas consultas, e por isso é oferecida.

## 6. Endpoints utilizados

| Endpoint                                    | Uso                           |
| ------------------------------------------- | ----------------------------- |
| `GET/PATCH /identity/me`                    | dados pessoais e preferências |
| `POST /identity/me/password`                | trocar a própria senha        |
| `GET /identity/me/sessions`                 | dispositivos                  |
| `DELETE /identity/me/sessions/:id`          | encerrar sessão               |
| `POST /identity/me/mfa/enrollment`          | iniciar dois fatores          |
| `POST /identity/me/mfa/enable`              | confirmar com o código        |
| `DELETE /identity/me/mfa`                   | desativar                     |
| `GET/PATCH /organizations/current`          | dados e `settings`            |
| `GET /organizations/current/subscription`   | plano, capabilities, limites  |
| `GET /organizations/current/usage`          | consumo do período            |
| `GET /organizations/current/business-units` | unidades                      |
| `GET/PATCH /notifications/preferences`      | preferências por evento       |
| `GET /scheduling/calendars` · `POST`        | calendários                   |
| `GET /artifact-rendering/metrics`           | renderizadores disponíveis    |
| `GET /integrations` (+ CRUD, validate)      | integrações                   |
| `GET /session`                              | contexto ativo, via BFF       |

## 7. Lacunas do backend

| Lacuna                                                                      | O que a tela faz                       |
| --------------------------------------------------------------------------- | -------------------------------------- |
| **Tema** — `PATCH /identity/me` recusa `theme`                              | declara; não guarda no navegador (§8)  |
| **Foto de perfil** — `avatarUrl` publicado, não editável; sem upload        | declara                                |
| **Histórico de acesso** — `/identity/me/audit` e `/login-history` → 404     | mostra quando cada sessão começou      |
| **Auditoria da organização** — `audit_logs` existe, nenhuma rota o expõe    | declara                                |
| **Sessões da organização** — só existe o contrato pessoal                   | declara, e leva ao Perfil              |
| **Políticas de segurança** — expiração, tentativas, bloqueio não publicados | descreve o comportamento               |
| **MFA obrigatório** — é opcional por pessoa, sem política organizacional    | declara                                |
| **API Keys, Webhooks, SSO** → 404                                           | declara na aba Integrações             |
| **`settings` sem esquema** — `Json?` livre                                  | só a chave que a plataforma lê         |
| **Retenção de documentos** — sem contrato                                   | declara                                |
| **`quietHours`** — campo existe, JSON livre, ninguém interpreta             | declara                                |
| **Canal SMS** — está no literal, o DTO de preferência recusa                | não é oferecido                        |
| Editar/remover calendário existem no contrato                               | ainda não expostos — é ação destrutiva |

## 8. Por que o tema não foi implementado

`PATCH /identity/me` recusa `theme` (verificado), e a aplicação **não tem
alternância de tema**: existe `.dark` no CSS e nada o aciona.

Guardar a escolha no navegador seria a _configuração paralela_ que o enunciado
proíbe — um valor que o backend não conhece, que não acompanha a pessoa entre
dispositivos, e que teria de ser migrado quando o contrato existir.

Persistir preferência para um recurso que não existe é construir pela ponta
errada. A ausência é declarada na aba.

## 9. Integrações

| Módulo                       | Como                                                      |
| ---------------------------- | --------------------------------------------------------- |
| **Organization Workspace**   | as mesmas seções, reusadas                                |
| **Workforce**                | papéis, situação de membro e escalas são administrados lá |
| **Document Center / Studio** | templates e documentos alcançados daqui                   |
| **Scheduling**               | calendários aqui, lembretes no Workspace                  |
| **Notifications**            | preferências aqui, central de leitura no Workspace        |
| **Dashboard**                | mesmas capabilities e plano, da mesma sessão              |

Nenhuma rota é montada à mão: `ROUTES` resolve tudo.

### Uma correção de rota

`UsersSection` do Organization Workspace declarava que não havia endpoint para
listar membros nem papéis — verdade quando foi escrita, falsa desde a PR-12 e a
PR-17. Substituída por um atalho para a Equipe.

## 10. Preparação para evoluções

| Evolução                       | O que já está no lugar                            | O que falta                                   |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------- |
| **MFA**                        | **implementado** — enrollment, enable, disable    | política organizacional (exigir para todos)   |
| **SSO**                        | `Credential` é senha local                        | provedor externo em contrato                  |
| **API Keys**                   | toda autorização passa por permissão + capability | portador que não é pessoa, com escopo próprio |
| **Webhooks**                   | fila de jobs em background (PR-20)                | modelo de assinatura e entrega                |
| **Auditoria avançada**         | `audit_logs` grava com antes/depois               | rota que o publique ao tenant                 |
| **Preferências por módulo**    | `settings` é JSON livre                           | esquema, para que a tela saiba o que oferecer |
| **Marketplace de integrações** | `/integrations` com provedores e `validate`       | catálogo de provedores publicado              |

Cada uma entra como seção da aba correspondente, consumindo o mesmo Workspace
Core — sem tela nova, sem tipo paralelo, sem segunda consulta.

## 11. Nenhuma regra de negócio no frontend

- não valida senha atual — `IHashProvider.verify` é do servidor;
- não decide quais sessões revogar ao trocar a senha;
- não valida código de MFA;
- não calcula percentual de limite — usa `used` e `limits`, ambos publicados;
- não interpreta `settings` além da única chave que a plataforma lê;
- não infere política de segurança — descreve o que o servidor aplica;
- não guarda preferência que o backend não conheça;
- não autoriza — permissões e capabilities são as que o backend exige.

A única validação local é a **confirmação de senha**, e ela existe porque o
backend nem recebe esse campo: é proteção contra erro de digitação, a única
coisa que o servidor não teria como notar.
