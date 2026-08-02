# Entity Registry

Definição única de como cada entidade da plataforma se apresenta e o que se
pode fazer com ela.

É o quarto registry desta base, e segue a mesma filosofia dos três anteriores:

| Registry            | Resolve                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| Metric Registry     | id de métrica → rótulo, ícone, formato, procedência                      |
| Widget Registry     | tag de widget → componente que sabe renderizá-la                         |
| Field Registry      | tipo de campo → como exibir e editar o valor                             |
| **Entity Registry** | **id de entidade → rótulo, ícone, cor, rota, capability, badges, ações** |

O problema que ele resolve é concreto: sem ele, um painel de "registros
relacionados" precisaria de `switch (tipo)` para saber o ícone de uma operação,
a rota de uma execução e o rótulo de um agendamento. Com ele, o painel recebe um
`EntityId` e desenha.

---

## 1. A definição

```ts
interface EntityDefinition {
  id: EntityId;
  label: string;
  labelPlural: string;
  description: string;
  icon: EntityIcon;
  color: string; // classe sobre tokens do Design System
  basePath: string; // de ROUTES
  capability: { read: string; manage: string };
  permissions: { read: string; create?; update?; delete? };
  badges: Record<string, EntityBadgeSet>;
  actions: readonly EntityAction[];
  href?: (id: string) => string; // ausente = entidade não navegável
}
```

### Duas propriedades que valem o desenho

**O registry não autoriza nada.** `capability` e `permissions` **declaram** o
que o backend exige (`@Capabilities`, `@Permissions`). Quem decide continua
sendo o servidor; a sessão só evita oferecer o que já se sabe que levaria 403.

**Os mapas de rótulo não são copiados.** `badges.status.labels` aponta para o
mapa que o módulo dono já mantém:

```ts
import { OPERATION_STATUS_LABELS } from "@/types/operations";
import { SCHEDULING_STATUS_LABELS } from "@/components/scheduling/event-badges";
```

Duas fontes divergiriam no primeiro status novo do backend. Valor fora do mapa
aparece cru — um status novo precisa ser visto, não virar "Outro".

---

## 2. Entidades registradas

| Id                   | Rota         | Capability de leitura      | Navegável             |
| -------------------- | ------------ | -------------------------- | --------------------- |
| `asset`              | `/ativos`    | `assets.read`              | ✓                     |
| `operation`          | `/operacoes` | `operations.read`          | ✓                     |
| `scheduling-event`   | `/agenda`    | `scheduling.read`          | ✓ (leva ao Workspace) |
| `artifact-execution` | `/execucoes` | `artifact_executions.read` | ✓                     |
| `artifact-template`  | `/artefatos` | `artifact_templates.read`  | ✓                     |
| `customer`           | `/clientes`  | `crm.read`                 | — sem tela até hoje   |

`customer` está registrado mesmo sem tela porque outras telas precisam do
rótulo, do ícone e da capability. `href` ausente significa "não navegável", e o
`EntityLink` rende texto simples em vez de um link que não leva a lugar nenhum.

`scheduling-event` não tem rota por evento — o detalhe abre em painel lateral
dentro do Workspace —, então o `href` leva ao Workspace. É uma característica
do módulo, declarada aqui em vez de descoberta na tela.

---

## 3. Como usar

```tsx
import { EntityBadge, EntityLink, useEntityAccess } from "@/entities";

<EntityLink entity="operation" id={operation.id} showIcon>
  {operation.title}
</EntityLink>

<EntityBadge entity="asset" group="status" value={asset.status} />

const { definition, can } = useEntityAccess("asset");
{can("update") ? <Button>Editar</Button> : null}
```

O painel de registros relacionados do Asset Workspace
(`related.sections.tsx`) é o exemplo completo: **um componente** desenha
operações, agendamentos e execuções, resolvendo tudo pelo `EntityId`.

---

## 4. Registrar uma entidade nova

1. Acrescente o id em `ENTITY_IDS`.
2. Acrescente a definição em `DEFINITIONS`, apontando `badges.*.labels` para o
   mapa que o módulo dono já mantém — **não copie rótulos**.
3. Use `ROUTES` no `basePath` e no `href`; não escreva caminho literal.
4. Declare `capability` e `permissions` com as **mesmas chaves** que o
   controller exige. Divergir aqui esconde botões que funcionariam, ou mostra
   botões que levam 403.
5. Se a entidade não tem tela, omita `href`.

Nada mais precisa mudar: entidade não registrada já não quebra a tela —
`resolveEntity` devolve uma definição derivada e avisa no console em
desenvolvimento, uma vez por id, como fazem os outros registries.

---

## 5. O que **não** pertence ao registry

- **Dados.** Ele não busca nada; quem busca é a Query Layer.
- **Autorização.** Ele declara o que o backend exige, não decide.
- **Regra de negócio.** Se uma transição é válida, se um registro pode ser
  excluído, se um valor é obrigatório — tudo isso é do servidor.
- **Formatação de métrica.** Isso é do Metric Registry.
