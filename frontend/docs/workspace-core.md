# Workspace Core

O que todo Workspace repete — com um dono.

`src/workspace/` · `import { WorkspacePage, useListController } from "@/workspace"`

---

## 1. A regra

**Nenhum Workspace mantém implementação própria do que existe aqui.** Filtro,
busca, paginação, contagem, estados de carga, cartão de indicador e o esqueleto
de página têm um dono.

O que continua de cada Workspace: quais filtros oferecer, o que cada linha
mostra, e como a tela conta a sua própria história. O Core cuida da moldura.

**Nada aqui é Design System novo.** Tudo usa `Button`, `Input`, `Label`,
`Select`, `Skeleton` e os tokens já existentes — o que muda é onde a composição
mora.

## 2. `WorkspacePage`

Nove páginas escreveram a mesma pilha à mão:

```tsx
<RequireAuth>
  <RequireActiveSubscription>
    <RequireCapability capability="…">
      <AppShell activeLabel="…" breadcrumb={…}>
        <ContentContainer size="wide" className="space-y-8">
          <header className="space-y-2 border-b border-border pb-6">
```

Nove vezes a mesma ordem de guards, a mesma classe de cabeçalho, o mesmo
`pb-6`. Hoje:

```tsx
export default function AssetsPage() {
  return (
    <WorkspacePage entity="asset">
      <AssetsList />
    </WorkspacePage>
  );
}
```

Título, descrição, capability e rótulo do menu saem do **Entity Registry** — a
mesma fonte que o guard consulta e que o backend exige.

### A ordem dos guards não é decorativa

`RequireActiveSubscription` vem **antes** de `RequireCapability` para que plano
vencido mostre "assinatura bloqueada", e não "recurso não incluído" — que é
verdade mas confunde, porque o recurso _está_ no plano; o que venceu foi a
assinatura.

### Props

| Prop                        | Para quê                                           |
| --------------------------- | -------------------------------------------------- |
| `entity`                    | tudo vem do Entity Registry (caminho preferido)    |
| `title` / `description`     | telas que não são de uma entidade                  |
| `capability` / `permission` | guarda própria; `permission` para a Administração  |
| `header={false}`            | telas de detalhe, cujo cabeçalho mostra o registro |
| `contained={false}`         | telas que gerenciam a própria largura              |
| `suspense={false}`          | quando o conteúdo já resolve os próprios estados   |
| `action`                    | ação principal no canto do cabeçalho               |
| `breadcrumb`                | trilha; por padrão, o título                       |

## 3. `useListController`

Seis listagens escreveram o mesmo bloco: um estado para o termo digitado, um
`useEffect` com `setTimeout` de 400 ms, um segundo estado para o termo que de
fato viaja, e a lembrança de voltar para a página 1 quando um filtro muda.

Seis chances de esquecer a última parte — e o sintoma é sutil: filtrar na
página 3 devolve uma página vazia.

```ts
const list = useListController<AssetQuery>({ limit: 20 });

list.searchTerm;              // o que está no campo, a cada tecla
list.query;                   // { page, limit, search, …filtros }
list.setFilter("status", v);  // volta para a página 1 sozinho
list.patch({ … });
list.nextPage() / previousPage() / setPage(n)
list.reset();
list.isFiltered;
```

Não conhece endpoint, não busca nada e não sabe que filtros existem — quem
declara é a tela, e quem valida é o backend.

## 4. Primitivos de listagem

| Componente      | Substituiu                                           |
| --------------- | ---------------------------------------------------- |
| `SearchField`   | 6 cópias do campo com a lupa posicionada             |
| `FilterSelect`  | 3 `FilterSelect` privados + 6 sentinelas `"__all__"` |
| `FilterBar`     | a grade de filtros com o botão "Limpar"              |
| `ResultSummary` | 6 cópias de "1–20 de 137"                            |
| `Pagination`    | **7** cópias do bloco Anterior/Próxima               |
| `ListState`     | 13 cadeias `isPending ? … : error ? … : vazio ? …`   |
| `MetricCard`    | 3 cartões de indicador (`KpiCard`, dois `Counter`)   |

### A sentinela `"__all__"`

O Radix Select não aceita `value=""` — é como ele representa "nada
selecionado". A opção "Todos" precisa de um valor real. `FilterSelect`
encapsula isso: quem usa passa e recebe `undefined`, e nunca vê a sentinela.

### `ListState`: a ordem importa

Carregando, **erro**, vazio, conteúdo — nesta ordem. Erro antes de vazio,
porque uma consulta que falhou tem zero itens e mostraria "nenhum resultado"
quando o certo é oferecer "tentar de novo". Era isso que se perdia nas cópias.

### `MetricCard`: a divergência era um defeito

Os três cartões divergiam em como tratavam a ausência de valor. Um deles
mostrava esqueleto para sempre quando a consulta falhava — prometendo um número
que nunca vinha. Agora `failed` e `isPending` são estados distintos, e falha diz
"indisponível".

## 5. Query Core

`src/hooks/api/cache-policy.ts`

Oito arquivos declararam `const MINUTE = 60_000` e escolheram `staleTime` e
`refetchInterval` em números soltos. Os números eram razoáveis — o problema é
que **eram só números**: ninguém conseguia dizer se a diferença era intencional.

```ts
const POLICY = {
  list: CACHE.live, // muda sozinho: outra pessoa cria uma operação
  detail: CACHE.fresh, // muda por ação de quem está olhando
  catalog: CACHE.stable, // muda quando alguém configura
} as const;
```

| Política    | `staleTime` | Revalida sozinha | Para quê                          |
| ----------- | ----------- | ---------------- | --------------------------------- |
| `live`      | 15 s        | a cada minuto    | filas, contadores                 |
| `fresh`     | 30 s        | não              | detalhe que quem olha é quem muda |
| `stable`    | 1 min       | não              | cadastros, listas de referência   |
| `catalog`   | 10 min      | não              | planos, calendários, versões      |
| `immutable` | ∞           | não              | versão publicada — não muda mais  |

`every(CACHE.live, 2 * MINUTE)` ajusta o intervalo sem reescrever a política.

A regra que orienta a escolha: **revalidar sozinho apenas o que muda sem o
usuário fazer nada.** Um formulário não se recarrega.

### `pollWhile`

```ts
refetchInterval: pollWhile<RenderState>(
  (state) => resolveRenderStatus(state.renderStatus).inFlight,
  3 * SECOND,
);
```

Revalida enquanto o servidor trabalha, para quando ele termina. O predicado lê
`inFlight` do **Document Registry** — o mesmo dado que pinta o crachá — então um
estado novo do backend passa a ser acompanhado sem tocar no hook.

## 6. Navigation Core

`src/navigation/`

**Nenhuma rota é montada à mão.** Caminho de listagem vem do Entity Registry
(`basePath`), caminho de registro vem de `entityHref`, e áreas que não são de
entidade vêm de `ROUTES`.

```ts
entityCrumbs("asset"); // Ativos
entityCrumbs("asset", "Workspace"); // Ativos › Workspace
crumbs("Organização");
entityTargets(); // destinos, do Entity Registry
```

`<Breadcrumbs>` transforma isso em caminho navegável. Antes cada página
escrevia `<span>Ativos · Workspace</span>` — cinco convenções diferentes para a
mesma coisa, e nenhuma delas clicável.

### Paleta de comandos

Era uma lista fixa da fase de design: "Inventário", "Pessoas", "Abrir
calculadora" — três módulos que não existem — e **nenhum item navegava**. Hoje
os destinos vêm do Entity Registry e as ações do Action Registry, filtrados
pelas capabilities da sessão.

Ela **não executa ações**: leva ao lugar onde a ação existe, porque executar
exige o contexto que só a tela tem.
