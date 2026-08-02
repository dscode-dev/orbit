# Registry Core — proposta

**Não implementado.** Este documento descreve a infraestrutura comum para a
qual os registries devem convergir, conforme pedido na PR-10. Nenhuma
implementação atual foi alterada.

---

## 1. O que já é comum entre os quatro registries

|                                             | Metric | Widget  | Field | Entity |
| ------------------------------------------- | ------ | ------- | ----- | ------ |
| Tabela `id → definição`                     | ✓      | ✓       | ✓     | ✓      |
| `Map` indexado por id                       | ✓      | ✓       | ✓     | ✓      |
| `resolve(id)` com fallback                  | ✓      | parcial | ✓     | ✓      |
| Aviso uma vez por id em desenvolvimento     | ✓      | ✓       | ✓     | ✓      |
| `Set` de ids já reportados                  | ✓      | ✓       | ✓     | ✓      |
| Definição declarativa, sem efeito colateral | ✓      | ✓       | ✓     | ✓      |

O padrão foi replicado quatro vezes — de propósito, porque cada um nasceu de
uma necessidade diferente e a repetição era mais barata que uma abstração
prematura. Com o quarto registry pronto e o quinto (Action) previsto, o padrão
está estável o suficiente para ser extraído.

O que **difere** entre eles é só a forma da definição e o que o fallback
devolve — exatamente o que um núcleo genérico deve parametrizar.

### Uma divergência que o núcleo corrigiria

O Widget Registry **ignora** a tag desconhecida; os outros três **derivam** uma
definição e seguem renderizando. Duas políticas para o mesmo problema, escolhidas
em momentos diferentes. Um núcleo comum obrigaria a decidir isso uma vez — e a
política certa depende do registry (ignorar um widget é aceitável; ignorar um
campo esconderia dado do usuário), então a escolha vira **configuração
explícita** em vez de acidente histórico.

---

## 2. O contrato proposto

```ts
interface RegistryOptions<TDefinition> {
  /** Nome do registry nos avisos: "metrics", "entities", … */
  name: string;
  /** Extrai o id da definição. */
  identify: (definition: TDefinition) => string;
  /**
   * O que fazer com um id desconhecido.
   * - "derive": constrói uma definição a partir do próprio id/contrato
   * - "ignore": devolve `undefined` e deixa a superfície decidir
   */
  onUnknown:
    | { kind: "derive"; derive: (id: string, hint?: unknown) => TDefinition }
    | { kind: "ignore" };
  /** Validação opcional, aplicada uma vez ao registrar (só em desenvolvimento). */
  validate?: (definition: TDefinition) => readonly string[];
}

function createRegistry<TDefinition>(
  definitions: readonly TDefinition[],
  options: RegistryOptions<TDefinition>,
): {
  all: () => readonly TDefinition[];
  get: (id: string) => TDefinition | undefined;
  resolve: (id: string, hint?: unknown) => TDefinition | undefined;
  has: (id: string) => boolean;
};
```

Cada registry existente passa a ser uma chamada:

```ts
const registry = createRegistry(DEFINITIONS, {
  name: "entities",
  identify: (entity) => entity.id,
  onUnknown: { kind: "derive", derive: deriveEntity },
});
export const resolveEntity = registry.resolve;
```

---

## 3. O que o núcleo acrescenta além de tirar repetição

**Validação no registro.** Hoje um erro de digitação numa capability
(`assets.raed`) só aparece quando alguém percebe que o botão sumiu. Um
`validate` rodando em desenvolvimento avisaria no momento em que a definição é
carregada — e o Entity Registry já tem candidatos óbvios: permissões e
capabilities com prefixo conhecido, `href` coerente com `basePath`,
`badges.*.labels` não vazio.

**Logging uniforme.** Hoje cada registry escreve a própria mensagem de aviso,
com formato levemente diferente. Um formato só facilita achar todos em uma
sessão de desenvolvimento — e permite, no futuro, contabilizar quais chaves
desconhecidas o produto recebe em produção.

**Colisão de id.** Nenhum dos quatro detecta duas definições com o mesmo id
hoje; a última silenciosamente ganha. O núcleo detectaria no registro.

---

## 4. O que **não** entra no núcleo

- **A forma da definição.** Cada registry conhece o próprio domínio; o núcleo
  é genérico sobre `TDefinition`.
- **Componentes.** `EntityLink`, `MetricProvenanceMark` e o resto continuam
  onde estão — o núcleo é resolução, não apresentação.
- **Dados.** Registry não busca nada.
- **Autorização.** Continua declarativa: o registry diz o que o backend exige,
  o servidor decide.

---

## 5. Ordem de migração sugerida

1. **Entity Registry** — o mais novo e o menos acoplado; serve de piloto.
2. **Field Registry** — mesma política de fallback, definição simples.
3. **Metric Registry** — tem `hint` (o contrato do backend) no `resolve`, que é
   o caso que exige o parâmetro opcional.
4. **Widget Registry** — exige decidir a política de desconhecido (§1).
5. **Action Registry** — nasce já sobre o núcleo.

Cada passo é isolado: o núcleo é aditivo, e um registry migrado não obriga os
outros. Enquanto a migração não acontece, **nada muda** — que é o estado desta
PR.
