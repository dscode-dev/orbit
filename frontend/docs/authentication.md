# Orbit V2 — Autenticação e Sessão (Frontend PR-02)

Experiência completa de autenticação e gerenciamento de sessão, construída
sobre o Frontend Core da PR-01 ([`frontend-core.md`](./frontend-core.md)).
Nenhuma chamada nova ao backend foi criada fora daquela camada, e o Design
System não foi alterado.

---

## 1. Caminhos de entrada

O Orbit tem três formas de alguém passar a ter acesso:

| Caminho | Endpoint do backend | Quem usa |
| --- | --- | --- |
| Onboarding público | `POST /identity/register` | Cliente que assina um plano |
| Convite | `POST /identity/invitations/accept` | Usuário convidado para uma organização existente |
| Provisionamento pelo operador | `POST /platform-admin/tenants` | Platform Administrator (API; painel virá depois) |

### 1.1 Onboarding público — `/cadastro`

```
Escolha do plano ──► Owner ──► Organização ──► Unidade principal ──► sessão ──► /dashboard
     GET /plans                    POST /identity/register (transacional)
```

1. **Escolha do plano** — `GET /plans` (rota `@Public()` do backend) lista os
   planos ativos. A escolha vira `planKey`.
2. **Owner, organização e unidade** — os três passos seguintes preenchem um
   único payload.
3. **`POST /identity/register`** cria, na mesma transação: usuário e
   credencial, organização, unidade principal, papel `OWNER` e as duas
   memberships — e já devolve o par de tokens.
4. O BFF grava os cookies `HttpOnly` e o usuário chega autenticado ao
   dashboard. Não existe passo de "login automático" separado: o registro já
   autentica.

### 1.2 Convite — `/convite?token=…`

`POST /identity/invitations/accept` cria a credencial do convidado dentro de
uma organização existente, com papel e unidade definidos por quem convidou. O
endpoint devolve 204 e **não** autentica: a tela encaminha para o login.

### 1.3 Recuperação de senha

```
/recuperar-senha  ──► POST /identity/password/forgot  (202, sempre igual)
        e-mail com token (30 min)
/redefinir-senha?token=… ──► POST /identity/password/reset (204)
```

A resposta de `forgot` é idêntica para e-mail existente ou não — a tela
reproduz esse comportamento para não revelar quais contas existem.

---

## 2. Platform Administrator

Um administrador global **não pertence a nenhuma organização**:
`PlatformRoleAssignment` liga o usuário a um papel com `organizationId = null`.
No login, o `AuthenticationService` inclui esse papel e suas permissões no JWT,
mas `organizationId` continua `null`.

Consequência prática para o frontend: **rotas de tenant não servem para ele**.
`GET /organizations/current` e qualquer rota com contexto de organização
respondem 403. Por isso:

- o destino após autenticar depende do tipo de conta
  (`homeRouteFor` em [`src/lib/routes.ts`](../src/lib/routes.ts));
- o middleware manda o administrador de `/dashboard` para `/plataforma` e
  devolve usuários de tenant que tentem `/plataforma` para `/dashboard`;
- a composição da sessão nem dispara as chamadas de organização e plano quando
  o token não traz `organizationId`;
- `/plataforma` é apenas a landing autenticada — o painel (`/platform-admin/*`)
  é escopo de uma PR posterior. O `RequirePlatformAdmin` e a raiz
  `platform-admin` já estão liberados no BFF.

O backend revalida a atribuição `PLATFORM_ADMIN` a cada requisição
autenticada: revogar o papel encerra a sessão sem esperar o token expirar. O
frontend não precisa tratar isso — a próxima chamada recebe 401 e o fluxo de
sessão expirada assume.

---

## 3. Gerenciamento da sessão

### 3.1 Onde cada coisa mora

```
cookies HttpOnly (orbit_access, orbit_refresh)   ← só o servidor lê
        │
        ▼
GET /api/auth/session   ← compõe a sessão no BFF
        │
        ▼
SessionProvider (TanStack Query)   ← única fonte no browser
        │
        ├── useSession()        perfil, papéis, permissões, plano, capabilities
        ├── useActiveScope()    organização e unidade ativas + troca
        └── guards              decisões de rota
```

### 3.2 O que `/api/auth/session` devolve

Três chamadas em paralelo, compostas em um único payload (sem tokens):

| Origem | Campos |
| --- | --- |
| `GET /identity/me` | `user` |
| `GET /organizations/current` | `organization`, `businessUnits` |
| `GET /organizations/current/subscription` | `entitlements` (plano, status, capabilities, limites) |
| Claims do access token | `scope`, `roles`, `permissions`, `sessionId`, `expiresAt` |

Derivados: `isPlatformAdmin`, `subscriptionActive`, `requiresPasswordChange`.

`GET /organizations/current` exige assinatura ativa (`@RequiresActivePlan`) e
responde 403 quando o plano vence. A composição tolera essa falha: a sessão
continua existindo, com `organization: null` e `subscriptionActive: false`,
para que a aplicação mostre o estado de assinatura bloqueada em vez de
expulsar o usuário para o login.

### 3.3 Renovação e expiração

| Momento | Quem renova |
| --- | --- |
| Navegação para rota protegida | middleware (`proxy.ts`), antes de qualquer Server Component |
| Chamada de API com token vencido | proxy do BFF: renova e repete a requisição uma vez |
| Aba parada por muito tempo | `POST /api/auth/refresh` (opcional, sob demanda) |

O backend consome o refresh token a cada uso. Duas proteções em
[`src/server/auth/refresh.ts`](../src/server/auth/refresh.ts):

1. **Deduplicação de chamadas simultâneas** — o mesmo token compartilha uma
   única promessa.
2. **Janela de rotação (15 s)** — requisições que partiram do browser com o
   cookie antigo, mas chegaram *depois* da rotação, recebem o par recém-emitido
   em vez de tentar consumir um token já usado.

Sem a segunda proteção, uma tela que dispara várias chamadas em paralelo com o
token vencido derrubava a sessão do usuário: a primeira renovava e as demais
recebiam 401. Verificado: 8 chamadas simultâneas → 8 respostas 200 e **uma**
chamada de refresh no backend.

Quando a renovação falha de verdade, o BFF limpa os cookies e responde
`SESSION_EXPIRED`; o middleware manda para
`/login?motivo=sessao-expirada&destino=…` e a tela de login explica o que
aconteceu.

### 3.4 Sessão persistente

O cookie de refresh dura 30 dias (`SameSite=Lax`, `Secure` em produção). Fechar
o browser não encerra a sessão; `POST /api/auth/logout` revoga no backend e
apaga os cookies.

---

## 4. Guards

Em [`src/guards`](../src/guards). Todos compartilham o `SessionGate`: resolvem a
sessão uma vez (cache do TanStack Query) e decidem entre liberar, redirecionar
ou bloquear — sem piscar conteúdo protegido.

| Guard | Exige | Bloqueio |
| --- | --- | --- |
| `RequireAuth` | sessão + organização | redireciona ou estado "sem organização" |
| `RequireGuest` | visitante | redireciona para a home do tipo de conta |
| `RequirePermission` | permissão (`@Permissions`) | "acesso restrito" |
| `RequireRole` | papel (`@Roles`) | "acesso restrito" |
| `RequireCapability` | módulo do plano (`@Capabilities`) | "módulo indisponível no plano" |
| `RequireActiveSubscription` | assinatura ativa | "assinatura inativa" + sair |
| `RequirePlatformAdmin` | `PLATFORM_ADMIN` | redireciona para o dashboard |

**Os guards não são a autorização.** Quem autoriza é o NestJS; eles existem
para não expor telas que o usuário não conseguiria usar e para redirecionar de
forma previsível.

**Módulo habilitado = capability do plano.** `plan.capabilities` é exatamente o
que o backend valida em `@Capabilities('operations.read')`. Usar a mesma chave
nos dois lados evita uma tabela de módulos paralela no frontend.

---

## 5. Organização e unidade ativas

`useActiveScope()` junta o que a sessão conhece com o que o usuário
selecionou; os módulos consultam só ele.

```ts
const { organization, businessUnit, businessUnits, switchBusinessUnit } = useActiveScope();
```

Trocar de unidade atualiza o contexto da PR-01 (o cabeçalho
`x-business-unit-id` passa a acompanhar toda chamada) e descarta o cache das
queries do escopo anterior, preservando a sessão.

### Multi-organização — estado real

O backend **ainda não expõe troca de organização**. `AuthenticationService`
deriva a organização de `organizationMemberships[0]` e não existe endpoint para
listar as organizações do usuário nem para trocar a ativa. O modelo de dados já
permite (`OrganizationMembership` é N:N).

O que está pronto no frontend:

- `session.organizations` (hoje com a organização ativa) e
  `canSwitchOrganization` (hoje `false`, pois a lista tem um item);
- `switchOrganization()` atualizando o contexto e limpando o cache;
- o cabeçalho `x-organization-id` já viaja em toda requisição.

O que falta no backend para ativar: um endpoint que liste as organizações do
usuário e outro que emita um token com a organização escolhida (ou que passe a
honrar `x-organization-id`, validando a membership). Nenhuma mudança de
arquitetura no frontend será necessária — a lista passa a ter mais de um item e
o seletor se habilita sozinho.

> Enquanto isso, `x-organization-id` e `x-business-unit-id` são informativos
> para o backend: o escopo efetivo e o RLS vêm das claims do token. Onde um
> endpoint aceita `businessUnitId` como filtro (ex.: `OperationQueryDto`),
> passe-o explicitamente na query.

---

## 6. Como um novo módulo usa a sessão

Nada de refazer chamadas de sessão, ler cookies ou montar contexto.

```tsx
"use client";
import { RequireAuth, RequireCapability } from "@/guards";
import { useActiveScope, useSession } from "@/providers";

export default function OperacoesPage() {
  return (
    <RequireAuth>
      <RequireCapability capability="operations.read">
        <OperacoesView />
      </RequireCapability>
    </RequireAuth>
  );
}

function OperacoesView() {
  const { hasPermission } = useSession();
  const { businessUnit } = useActiveScope();
  // dados via hooks da PR-01; o contexto já acompanha a requisição
  return <>{hasPermission("operations.create") ? <NovaOperacao /> : null}</>;
}
```

Regras:

1. **Uma fonte de sessão** — `useSession()`. Não chame `/identity/me` nem
   `/organizations/current` de novo: já estão na sessão.
2. **Escopo ativo** — `useActiveScope()`, nunca `session.scope` combinado à mão
   com o contexto de requisição.
3. **Proteção de tela** — guards, não `if` espalhado pelos componentes.
4. **Permissão vs. módulo** — `hasPermission` para ação do usuário
   (`@Permissions`), `hasCapability` para módulo do plano (`@Capabilities`).
5. **Depois de mutações que mudam a sessão** (aceitar convite, trocar plano),
   chame `session.refresh()`.

---

## 7. Limitações conhecidas (backend)

Levantadas durante a implementação, com o frontend já preparado:

| Assunto | Situação no backend | Frontend |
| --- | --- | --- |
| Troca de organização | sem endpoint; login usa a primeira membership | plumbing pronto (seção 5) |
| Troca de senha obrigatória | coluna `Credential.mustChangePassword` existe, mas nunca é lida nem exposta por `GET /identity/me` | `requiresPasswordChange` é lido de forma opcional; guard e tela prontos. Basta o backend passar a devolver o campo |
| Troca de senha autenticada | `UpdateProfileDto` não aceita senha; só existe o fluxo por token de e-mail | a tela de troca obrigatória usa o fluxo por e-mail, que funciona hoje. Com um `PATCH /identity/me/password`, muda só o submit |

Nenhuma dessas lacunas foi contornada com mock ou dado fictício.

---

## 8. Validação executada

16 cenários exercitados por HTTP contra o BFF real (rotas públicas sem sessão,
bloqueio das rotas de token, origem cross-site, login/logout, composição da
sessão, sessão do administrador sem organização, redirecionamentos do
middleware) mais 6 cenários de expiração e renovação — incluindo a corrida de
renovação descrita em 3.3, que revelou e validou a correção da janela de
rotação.

```bash
npm run typecheck   # sem erros
npm run lint        # sem erros
npm run build       # 16 rotas, middleware compilado
```
