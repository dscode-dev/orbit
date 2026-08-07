# Registry Kernel

A infraestrutura comum dos registries do Orbit.

`src/registry/` · `import { createRegistry, allowsAccess } from "@/registry"`

---

## 1. Por que existe

Sete registries nasceram separados e chegaram ao mesmo desenho. Cada um tinha a
sua cópia de quatro coisas:

```ts
const BY_ID = new Map(DEFINITIONS.map((x) => [x.id, x])); // índice
const reportedUnknown = new Set<string>(); // avisos
if (process.env.NODE_ENV !== "production" && !seen.has(id))
  // guarda
  return { id, label: id /* … */ }; // fallback
```

Sete cópias que precisavam ser corrigidas sete vezes. E foram: o `humanize` de
um registry lowercaseava a cauda da palavra e o de outro não, então
`NOT_RENDERED` virava `Not Rendered` num lugar e `NOT RENDERED` noutro.

O Kernel guarda **só isso**. Ele não sabe o que é uma entidade, uma métrica ou
um formato — sabe indexar, resolver e degradar. Cada registry continua dono do
seu vocabulário e da sua API pública.

## 2. `createRegistry`

```ts
const registry = createRegistry<EntityDefinition>({
  name: "entities", // aparece nas mensagens
  source: "src/entities/entity-registry.ts", // arquivo a editar
  entries: DEFINITIONS,
  normalizeId: (id) => id.trim().toUpperCase(), // opcional
  validate: (entry) => problema ?? null, // opcional, só em dev
  derive: (id) => ({ id, label: id /* … */ }), // fallback
});

registry.resolve(id); // sempre devolve algo
registry.get(id); // undefined quando não é declarado
registry.has(id);
registry.all();
registry.ids();
registry.index((entry) => entry.officialKey); // índice auxiliar
```

### O que ele dá de graça

| Recurso                | O que resolve                                           |
| ---------------------- | ------------------------------------------------------- |
| **Índice por id**      | busca O(1), com normalização opcional                   |
| **Ids duplicados**     | `console.error` em dev; a primeira declaração prevalece |
| **Validação**          | por registro, uma vez, só em desenvolvimento            |
| **Aviso único**        | um por id, não um por render                            |
| **Fallback memoizado** | ver §3                                                  |
| **Índice auxiliar**    | `index(keyOf)` — ex.: template oficial por `key`        |

## 3. O derivado é memoizado — e isso não é otimização

Antes, cada `resolve` de um id desconhecido construía um objeto novo. Duas
chamadas devolviam valores `!==`, o que derrota `useMemo`, `React.memo` e
qualquer comparação por referência.

O caminho de erro era justamente o que causava re-render em cascata. O cache
interno resolve: o mesmo id desconhecido devolve sempre a mesma referência.

## 4. `allowsAccess` — as exigências

Três registries chegaram à mesma função com três nomes:
`isTemplateActionEnabled`, `isDocumentActionEnabled` e o `allows` interno de
`useEntityAccess`. Todas perguntavam o mesmo: a ação existe? o papel tem a
permissão? o plano tem a capability?

```ts
interface AccessRequirement {
  permission?: string;         // exigida pelo backend (@Permissions)
  capability?: string;         // exigida pelo plano (@Capabilities)
  available?: boolean;         // false = o contrato não existe
  unavailableReason?: string;
}

allowsAccess(requirement, session): boolean;
accessBlockReason(requirement, session): string | null;
```

**Isto não é autorização.** Quem autoriza é o backend, e ele recusa com 403
independentemente do que aconteça aqui. O que estas funções evitam é oferecer
um botão que já se sabe que seria recusado.

Consequência declarada: exigência não declarada **libera**. Uma ação sem
`permission` e sem `capability` é sempre oferecida, e o servidor continua no
comando.

## 5. Quem usa

| Registry      | Arquivo                                                  | Entradas                          |
| ------------- | -------------------------------------------------------- | --------------------------------- |
| Entity        | `src/entities/entity-registry.ts`                        | 1                                 |
| Metric        | `src/metrics/metric-registry.ts`                         | 1 + cache por contrato            |
| Field         | `src/components/artifact-executions/fields/registry.tsx` | 1                                 |
| Template Type | `src/artifacts/template-type-registry.ts`                | 1 + índice por `officialKey`      |
| Document      | `src/documents/document-registry.ts`                     | 3 (formato, estado, renderizador) |
| Action        | `src/actions/action-registry.ts`                         | 1                                 |

### As duas exceções, e por quê

**Widget Registry** não usa `createRegistry`. Os outros sempre devolvem algo
exibível; ali a ausência é a resposta certa — widget desconhecido **some**, em
vez de virar card genérico ocupando espaço do painel sem dizer nada. O que ele
compartilha é o `warnUnknown`.

**Metric Registry** usa o Kernel para índice e aviso, mas tem `resolveMetric`
próprio: ele deriva do **contrato do backend** (que traz rótulo, unidade e
domínio), não só do id. O cache de derivados é local, pelo mesmo motivo de §3.

## 6. Regras

- **Nenhum componente compara id com string.** Resolve pelo registry.
- **O registry não decide o que o backend decide.** Não valida, não autoriza,
  não muda estado.
- **Valor desconhecido não quebra a tela.** Deriva, avisa em dev, segue.
- **Um id, um dono.** Ações estão no Action Registry; entidades no Entity
  Registry. Duas listas para a mesma coisa divergem — e divergiram.
