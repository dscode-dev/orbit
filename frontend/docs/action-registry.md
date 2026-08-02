# Action Registry — preparação

**Não implementado.** Este documento descreve a arquitetura pretendida e como o
código já está organizado para recebê-la, conforme pedido na PR-09.

---

## 1. O problema que ele vai resolver

Os quatro registries existentes cobrem apresentação:

| Registry        | Resolve                                                  |
| --------------- | -------------------------------------------------------- |
| Metric Registry | id de métrica → rótulo, ícone, formato, procedência      |
| Widget Registry | tag de widget → componente                               |
| Field Registry  | tipo de campo → como exibir e editar                     |
| Entity Registry | id de entidade → rótulo, ícone, rota, capability, badges |

Falta o eixo das **ações**. Hoje, "criar", "duplicar", "arquivar", "ativar",
"aprovar" aparecem como botões escritos à mão em cada tela, cada um repetindo o
mesmo trio: qual permissão exige, qual capability exige, e o que fazer quando o
servidor recusa.

Isso ainda não dói porque cada Workspace tem poucas ações. Vai doer quando a
mesma ação existir em três lugares — duplicar um template no Studio, na
listagem e na paleta de comandos — e as três cópias divergirem.

---

## 2. O contrato pretendido

```ts
interface ActionDefinition<TInput = void, TResult = unknown> {
  id: string;                       // "artifact-template.duplicate"
  entity: EntityId;                 // dono da ação
  label: string;
  icon: ActionIcon;
  /** Exigências declaradas — as mesmas chaves do backend. */
  permission?: string;
  capability?: string;
  /** Pede confirmação antes de executar. */
  destructive?: boolean;
  /** Como a interface a apresenta: botão, item de menu, atalho. */
  surfaces: readonly ActionSurface[];
  /** A mutação que executa. Sempre uma chamada real ao backend. */
  run: (context: ActionContext, input: TInput) => Promise<TResult>;
}

resolveAction(id): ActionDefinition | undefined
useAction(id): { available: boolean; run: (input) => Promise<…>; pending: boolean }
```

As mesmas três regras dos outros registries valem:

- **nenhum componente decide apresentação de ação** — resolve pelo registry;
- **o registry não autoriza nada** — declara o que o backend exige;
- **ação desconhecida não quebra a tela** — `resolveAction` devolve
  `undefined` e a superfície simplesmente não a oferece.

---

## 3. O que já está no lugar

**A semente existe no Entity Registry.** `EntityDefinition.actions` já declara
ações com `permission`, `capability` e `destructive`:

```ts
actions: [
  {
    id: "create",
    label: "Novo ativo",
    permission: "assets.create",
    capability: "assets.manage",
  },
  {
    id: "delete",
    label: "Excluir",
    permission: "assets.delete",
    capability: "assets.manage",
    destructive: true,
  },
];
```

E `useEntityAccess(entity).can("delete")` já responde "esta sessão pode ver este
botão?" sem que o componente conheça permissão alguma. O Action Registry é a
evolução natural: acrescentar a essas declarações o `run`, as superfícies e o
tratamento de recusa.

**As recusas já são tratadas por código, não por texto.** Os Workspaces reagem
a `ARTIFACT_EXECUTION_NOT_EDITABLE`, a `CONFLICT` do agendamento e ao 409 de
chave duplicada pelo **código** do erro. Quando as ações forem declarativas,
esse tratamento sobe para o registry sem reescrita.

**As mutações já são reutilizáveis.** Toda escrita passa por `useApiMutation`,
com invalidação declarada e `scope` para serializar. Um `run` do registry
chamaria exatamente esses hooks.

---

## 4. O que ainda falta decidir

- **Onde vive o `run`.** Ações precisam de hooks (`useApiMutation`), e hooks
  não podem ser chamados dentro de um objeto. A saída provável é o registry
  guardar uma _fábrica_ que o `useAction` instancia.
- **Superfícies.** Botão, item de menu, ação em lote e paleta de comandos têm
  requisitos diferentes de rótulo e confirmação.
- **Ações em lote.** Hoje nenhum endpoint aceita lote; quando aceitarem, a
  declaração precisa distinguir "uma por registro" de "uma para muitos".

---

## 5. O que **não** entra no Action Registry

- **Regra de negócio.** Se a transição é válida, se o registro pode ser
  excluído, se o limite foi atingido — sempre do servidor.
- **Autorização.** Continua declarativa: o registry diz o que o backend exige,
  o servidor decide.
- **Estado de dados.** Quem lê é a Query Layer.
