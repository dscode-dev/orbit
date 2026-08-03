# Template Type Registry

O catálogo de tipos de artefato do Orbit — e o lugar único onde a interface
decide o que um `artifactType` significa.

`src/artifacts/template-type-registry.ts` · `import { … } from "@/artifacts"`

---

## 1. Por que existe

O backend trata `artifactType` como **texto livre**:

```ts
@Transform(upper) @IsString() @Matches(/^[A-Z][A-Z0-9_.-]*$/) @MaxLength(80)
artifactType!: string;
```

Não há `@IsIn`, não há tabela de tipos, não há endpoint de catálogo. Qualquer
organização pode criar `RELATORIO_INTERNO_V3` e o servidor aceita.

O que o backend **não** publica é tudo de que a interface precisa para tratar
um tipo como algo conhecido: rótulo legível, descrição, categoria, ícone, cor,
qual entidade o artefato descreve, qual template oficial serve de ponto de
partida e quais ações fazem sentido.

Sem um lugar para isso, a decisão vira `template.artifactType === "PMOC"`
espalhado por componentes — que é exatamente o que este registry impede.

## 2. O contrato do registry

```ts
interface TemplateTypeDefinition {
  id: string; // === artifactType publicado pelo backend
  name: string;
  description: string;
  category: TemplateTypeCategory; // OPERACIONAL · CONFORMIDADE · COMERCIAL · DOCUMENTO
  icon: TemplateTypeIcon;
  color: string; // classe sobre tokens do Design System
  primaryEntity: EntityId; // resolvida no Entity Registry
  officialKey?: string; // key do template global correspondente
  actions: readonly TemplateTypeAction[];
  renderer: TemplateTypeRenderer; // referência apenas
  priority: number;
}
```

### `primaryEntity` liga ao Entity Registry

O tipo não repete rota nem rótulo de entidade: aponta para um `EntityId`, e
quem resolve caminho, ícone e permissões da entidade continua sendo o Entity
Registry. Um PMOC descreve um **equipamento**; um orçamento descreve um
**cliente**.

### `officialKey` liga ao catálogo semeado

É a `key` do template **global** (`ORBIT_*`) semeado no backend. É por ela que
a interface encontra o oficial dentro da listagem que já recebe — sem endpoint
novo, porque o repositório devolve globais e da organização na mesma consulta.

### `actions` declara o que existe e o que não existe

Cada ação nomeia a permissão e a capability que o **backend** exige, para a
interface não oferecer o que resultaria em 403. Quem autoriza continua sendo o
servidor.

Uma ação com `available: false` aparece declarada como indisponível — é o caso
de **Gerar documento**: `renderStatus` é sempre `NOT_RENDERED` e não existe
endpoint de renderização.

### `renderer` é referência, não promessa

Nomeia o renderizador que cada tipo usará quando o motor existir. `available` é
sempre `false` hoje. Nomear agora deixa a ligação declarada sem prometer nada.

## 3. Tipos registrados

| id                  | Nome                        | Categoria    | Entidade | Oficial                   |
| ------------------- | --------------------------- | ------------ | -------- | ------------------------- |
| `ORDEM_SERVICO`     | Ordem de Serviço            | Operacional  | operação | `ORBIT_ORDEM_SERVICO`     |
| `PMOC`              | PMOC                        | Conformidade | ativo    | `ORBIT_PMOC`              |
| `RELATORIO_VISITA`  | Relatório de Visita Técnica | Operacional  | cliente  | `ORBIT_RELATORIO_VISITA`  |
| `RELATORIO_TECNICO` | Relatório Técnico           | Documento    | ativo    | `ORBIT_RELATORIO_TECNICO` |
| `QUALIDADE_AR`      | Análise da Qualidade do Ar  | Conformidade | ativo    | `ORBIT_QUALIDADE_AR`      |
| `RECIBO`            | Recibo                      | Comercial    | cliente  | `ORBIT_RECIBO`            |
| `ORCAMENTO`         | Orçamento                   | Comercial    | cliente  | `ORBIT_ORCAMENTO`         |

## 4. Tipo desconhecido não quebra a tela

`resolveTemplateType` devolve uma definição derivada do próprio identificador —
rótulo humanizado, ícone genérico, categoria `DOCUMENTO` — e avisa no console
em desenvolvimento, uma vez por id.

O rótulo derivado é o **identificador humanizado**, nunca "Outro": um tipo novo
precisa aparecer para quem administra, não sumir.

```
RELATORIO_INTERNO_V3  →  "Relatorio interno V3"
```

## 5. Quem consome

| Consumidor               | O que resolve pelo registry                                 |
| ------------------------ | ----------------------------------------------------------- |
| `create-template-dialog` | escolha do tipo por cartão, com escape para texto livre     |
| `templates-filters`      | catálogo oferecido no filtro por tipo                       |
| `templates-list`         | rótulo, ícone, cor e categoria na coluna de tipo            |
| `artifact-studio`        | crachá do tipo no cabeçalho; oficial do tipo para restaurar |

**Nenhum deles compara `artifactType` com string.** A verificação é simples:

```bash
grep -rn 'artifactType ===' src/   # nenhum resultado
```

## 6. Registrar um tipo novo

Adicione uma entrada em `DEFINITIONS` com o mesmo `id` que o backend publica.
Se houver template oficial correspondente, acrescente-o a
`backend/src/scripts/artifact-templates/official-catalog.ts` e rode
`npm run seed:artifact-templates`.

## 7. O que o registry **não** faz

- não valida `artifactType` — quem valida é o `class-validator` do DTO;
- não cria template — quem cria é `POST /artifact-templates`;
- não autoriza — as permissões declaradas são as que o backend exige;
- não decide estrutura — seções e campos são do template, não do tipo.
