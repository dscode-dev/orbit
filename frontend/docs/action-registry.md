# Action Registry

O catálogo do que se pode fazer com uma entidade.

`src/actions/action-registry.ts` · `import { useAction } from "@/actions"`

---

## 1. O eixo que faltava

Os outros registries cobrem apresentação:

| Registry      | Resolve                                                  |
| ------------- | -------------------------------------------------------- |
| Metric        | id de métrica → rótulo, ícone, formato, procedência      |
| Widget        | tag de widget → componente                               |
| Field         | tipo de campo → como exibir e editar                     |
| Entity        | id de entidade → rótulo, ícone, rota, capability, badges |
| Template Type | `artifactType` → o que o artefato é                      |
| Document      | formato e estado → o que o documento emitido é           |

Faltava o eixo das **ações**. "Criar", "duplicar", "publicar", "renderizar"
viviam como botão escrito à mão em cada tela, cada um repetindo o mesmo trio:
qual permissão exige, qual capability exige, e se precisa confirmar.

### E divergiram

Três coisas que a fragmentação já tinha custado, encontradas ao consolidar:

**Um botão que nunca aparecia.** `EntityDefinition.actions` declarava as ações
do ativo, mas deixou `customer` com `actions: []`. `can("update")` era
**sempre falso**, e a seção de contatos do Customer Workspace nunca ficava
editável — embora `customers.update` exista no backend e o papel a tivesse.

**Uma declaração que envelheceu.** O `COMMON_ACTIONS` do Template Type Registry
marcava "gerar documento" como indisponível por "não há motor de renderização".
Verdade quando foi escrita, falsa desde a PR-20. Nenhuma tela consumia a lista,
então o erro passou despercebido.

**Exigências escritas duas vezes.** As ações de documento estavam no Document
Registry _e_ no Entity Registry, com permissões repetidas em ambos.

## 2. O contrato

```ts
interface ActionDefinition extends AccessRequirement {
  id: string; // "artifact-template.duplicate"
  entity: EntityId; // dono da ação
  label: string;
  description?: string;
  icon: ActionIcon;
  category: ActionCategory; // create · edit · workflow · document · destructive
  surfaces: readonly ActionSurface[]; // primary · menu · row · palette
  destructive?: boolean;
  confirm?: { title; body; confirmLabel };
  // de AccessRequirement:
  permission?: string;
  capability?: string;
  available?: boolean;
  unavailableReason?: string;
}
```

### Superfícies

A mesma ação tem exigências diferentes conforme onde aparece. Um botão primário
cabe numa tela; um item de menu cabe numa linha de tabela; a paleta de comandos
precisa de um rótulo que faça sentido fora de contexto — e só faz sentido
oferecer ali o que não depende de um registro selecionado.

### Padrões por categoria

`define()` aplica o que cada tela vinha repetindo: ação `destructive` já nasce
pedindo confirmação, ação `create` já nasce como botão primário e entra na
paleta.

Ação destrutiva sem `confirm` é erro de declaração, verificado pelo `validate`
do Kernel em desenvolvimento — o diálogo apareceria vazio.

## 3. `useAction`

```tsx
const duplicate = useAction("artifact-template.duplicate");
if (!duplicate.allowed) return null;
return <Button onClick={() => mutation.mutate()}>{duplicate.label}</Button>;
```

```ts
interface ActionState {
  definition: ActionDefinition;
  label: string;
  allowed: boolean; // vale oferecer o botão?
  blockReason: string | null; // por que não — para explicar em vez de sumir
  destructive: boolean;
  confirm: { title; body; confirmLabel } | undefined;
}
```

`useEntityActions(entity, surface)` devolve as ações daquela entidade que esta
sessão pode ver — é o que um menu de linha consome.

## 4. O que ele **não** faz

**Não executa.** Não há `run`, e a ausência é deliberada: executar exige hooks
(`useApiMutation`), e hooks não podem ser chamados de dentro de um objeto
literal. O `onClick` continua sendo o hook que a tela já tem. Amarrar execução
aqui exigiria que o registry conhecesse serviços — e ele voltaria a ser o lugar
onde a regra de negócio se esconde.

**Não autoriza.** Declara o que o backend exige; quem decide é o servidor, que
recusa com 403 independentemente do que esteja aqui.

**Não sabe regra de negócio.** Se a transição é válida, se o registro pode ser
excluído, se o limite do plano foi atingido — sempre do servidor. `destructive`
é uma dica de interface, não uma regra.

## 5. Ausência declarada

`available: false` diz "o contrato não existe", que é diferente de "não
autorizado". É o caso de `artifact-execution.share-document`: a URL assinada é
curta e pessoal, e não há endpoint que crie link público ou envie por e-mail.

O botão aparece desabilitado com a explicação no tooltip. Quando o contrato
existir, vira `available: true` e nada mais muda.

## 6. Quem consome hoje

| Tela                                      | Ação                                    |
| ----------------------------------------- | --------------------------------------- |
| `operations-list`                         | `operation.create`                      |
| `scheduling-workspace`, `reminder-center` | `scheduling-event.create`               |
| `artifact-studio`                         | `artifact-template.publish`             |
| `document-preview`                        | `.download-document`, `.share-document` |
| `render-panel`                            | `artifact-execution.render`             |
| `useEntityAccess().can()`                 | resolve `"<entidade>.<verbo>"`          |
| Paleta de comandos                        | superfície `palette`                    |

### O que ficou de fora, e por quê

Permissões finas que o registry não declara — `operations.assign`,
`operations.status.update`, anexos — continuam como `hasPermission` direto na
tela. Inventar ações para forçá-las ao catálogo criaria entradas que nada
representa; o registry cataloga ações, não checagens.
