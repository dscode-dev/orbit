# Organization Workspace

Ponto central de administração da empresa: organização, plano, capabilities,
unidades, integrações e usuários.

|               |                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Rota          | `/organizacao`                                                                                               |
| Guard da tela | permissão `organization.read`                                                                                |
| Escrita       | `organization.update`, `business_units.*`, `integrations.manage`                                             |
| Contratos     | `OrganizationContextReadModel` e `BusinessUnitReadModel` sincronizados; consumo e integrações **espelhados** |

---

## 1. Endpoints utilizados

| Endpoint                                             | Uso                                                       |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `GET /organizations/current`                         | identidade, segmento, status, `settings`, plano, unidades |
| `PATCH /organizations/current`                       | nome, segmento e `settings`                               |
| `GET /organizations/current/subscription`            | plano, status, capabilities, limites, período             |
| `GET /organizations/current/usage`                   | consumo do período (permissão `usage.read`)               |
| `GET /plans`                                         | catálogo — fonte de "quais capabilities existem"          |
| `GET /organizations/current/business-units`          | unidades                                                  |
| `POST` · `PATCH` · `DELETE` `…/business-units[/:id]` | criação, edição, remoção                                  |
| `GET /integrations`                                  | integrações configuradas                                  |
| `POST /integrations/:id/validate`                    | revalidação de credenciais                                |

---

## 2. Independência por painel, por capability

Cada painel tem consulta própria e `PanelFrame` próprio, com Error Boundary
local. Aqui isso é mais visível que nos Workspaces anteriores porque **cada
área exige uma autorização diferente**:

| Painel               | Exigência                                    |
| -------------------- | -------------------------------------------- |
| Organização          | `organization.update` para escrever          |
| Plano e capabilities | apenas sessão                                |
| Consumo              | permissão `usage.read`                       |
| Unidades             | capability `business_units.read` / `.manage` |
| Integrações          | capability `integrations.read` / `.manage`   |

**Verificado na API:** o plano STARTER — o único semeado — **não concede
`business_units.*`**:

```
GET /organizations/current/business-units
→ 403  "The current plan does not include the required capability"
```

O painel de unidades mostra acesso negado enquanto plano, capabilities,
consumo e integrações continuam funcionando. É o comportamento correto, e é
também um achado: **a administração de unidades é inacessível no único plano
existente**.

---

## 3. Branding: não existe contrato

`UpdateOrganizationDto` aceita exatamente três campos — `displayName`,
`primarySegment` e `settings`. Não há campo de logotipo, cor ou identidade
visual, nem no DTO nem no Read Model. Verificado:

```
PATCH /organizations/current  { "timezone": "America/Recife" }
→ 400  ['property timezone should not exist']

PATCH /organizations/current  { "settings": { "branding": { … } } }
→ 200  settings gravado como veio
```

O único lugar onde branding cabe é `settings`, que é JSON livre e que o backend
**não interpreta**. Então o painel edita `settings` como JSON — o mesmo
tratamento que o Artifact Studio dá a `configuration`.

Um seletor de cor gravando `settings.branding.primaryColor` inventaria um
esquema que o servidor não conhece e que nenhum outro cliente saberia ler.
Quando o backend publicar campos de branding, eles entram como campos de
verdade e o editor de JSON deixa de ser necessário.

**Nenhum processamento de imagem acontece no frontend**, como pedido — e nem
haveria onde: não há rota de upload de logotipo.

---

## 4. Plano, limites e consumo

`limits` vem de `entitlements.limits`; `used` vem de
`GET /organizations/current/usage`, que o **servidor** recorta pelo período
corrente da assinatura. A barra de proporção é apresentação de dois números
recebidos.

O que a tela não faz: decidir se o limite foi excedido ou bloquear ação por
isso. Quem recusa é `UsageService`, no momento da escrita.

**Consumo vazio não é consumo zero.** O endpoint devolve os registros de
`PlanUsage` do período; recurso sem registro aparece como "sem registro no
período", não como `0` — que afirmaria uma medição que não houve.

Valores reais da organização de teste: limites `users: 5`,
`businessUnits: 1`, `integrations: 2`, período de 02/08 a 16/08.

---

## 5. Capabilities

O backend **não publica catálogo de capabilities**. O que ele publica é
`GET /plans`, com a lista de cada plano. A união das listas é o conjunto que
existe no produto, e os planos que concedem cada uma são a origem. Tudo
derivado de contrato publicado.

A descrição de cada capability também não é publicada. A tela agrupa pelo
prefixo do módulo — a convenção visível nos próprios `@Capabilities(...)` — e
mostra a chave crua. Um dicionário de descrições escrito no frontend seria
documentação paralela, que envelhece na primeira capability nova.

---

## 6. Limitações encontradas no backend

| Limitação                                     | Consequência na tela                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sem contrato de branding**                  | `settings` editado como JSON; sem upload de logotipo                                                                                                            |
| **`timezone` não existe na organização**      | é por unidade, e **não é editável** — `UpdateBusinessUnitDto` é `PartialType(CreateBusinessUnitDto)`, que não tem `timezone`, `locale`, `currency` nem `status` |
| **Ativar/desativar unidade não existe**       | `status` é publicado na leitura e recusado na escrita; a tela não oferece o botão                                                                               |
| **Trocar unidade ativa não existe**           | o escopo é derivado das claims do token; a seleção da tela é preferência local que vira filtro `businessUnitId`                                                 |
| **Sem listagem de usuários**                  | `/identity/me` cobre só o próprio; `/platform-admin/users` é global                                                                                             |
| **Sem listagem de papéis**                    | `POST /identity/invitations` exige `roleId` sem fonte — convite não é oferecido                                                                                 |
| **Sem leitura de auditoria**                  | `auditLog` é escrito por todos os módulos, nenhum controller o expõe                                                                                            |
| **STARTER não concede `business_units.*`**    | painel de unidades inacessível no único plano semeado                                                                                                           |
| **Sem Read Model de consumo e de integração** | formas espelhadas do Prisma, com acesso tolerante                                                                                                               |
| **Integração valida, não sincroniza**         | o campo é `lastValidatedAt`; a tela usa esse nome                                                                                                               |
| **Sem catálogo de provedores de integração**  | a lista mostra o que foi configurado, não o que poderia ser                                                                                                     |

---

## 7. Query Layer

**Sem atualização otimista.** Todas as escritas podem ser recusadas por motivos
que o cliente não enxerga: documento duplicado, limite do plano, capability
ausente. As mutações que devolvem a entidade semeiam o cache com a **resposta**
— o estado confirmado; as que não devolvem nada invalidam.

Criar ou remover unidade muda o consumo (`businessUnits`) e a sessão, então a
escrita invalida `usage` e `session` além da lista. É o servidor que conta; o
que se faz aqui é pedir a contagem nova.

Nenhuma consulta se atualiza sozinha: administração muda por ato deliberado,
não por evento operacional.

---

## 8. Preparação para o Action Registry

Documentada em `docs/action-registry.md`. **Não implementada nesta PR**, como
pedido.

O que já está no lugar: as ações com permissão e capability são declaradas em
`EntityDefinition.actions`, e `useEntityAccess(entity).can(actionId)` responde
"esta sessão pode ver este botão?" sem que o componente conheça permissão
alguma. As recusas do servidor já são tratadas por **código de erro**, não por
texto. Nenhuma condicional de ação global espalhada por componentes de
apresentação.

---

## 9. Navegação

Os atalhos para os demais Workspaces saem do **Entity Registry**: rótulo,
ícone, rota e capability de leitura vêm de lá, e o atalho só aparece se o plano
concede a capability — o mesmo critério que o backend usa. Acrescentar um
Workspace é registrá-lo; a lista não muda.

---

## 10. Verificação contra a API real

```
GET /organizations/current/subscription   ✓  planKey, status, capabilities, limites, período
GET /organizations/current/usage          ✓  lista vazia (nada registrado)
GET /organizations/current/business-units ✓  403 — STARTER não concede a capability
GET /integrations                         ✓  lista vazia
GET /plans                                ✓  1 plano
PATCH settings { branding: … }            ✓  gravado como veio
PATCH { timezone }                        ✓  400 — o campo não existe

tsc --noEmit  ·  eslint .  ·  next build  ✓
Design System                             intacto
```

---

## 11. O que **não** foi implementado no frontend

- nenhum cálculo de limite ou de consumo — ambos vêm do servidor;
- nenhuma decisão de capability — o painel é de consulta;
- nenhum esquema de branding inventado;
- nenhuma ativação de unidade simulada;
- nenhum processamento de imagem;
- nenhum componente novo no Design System.
