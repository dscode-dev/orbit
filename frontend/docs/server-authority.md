# Autoridade do servidor na interface (PR-FE-01)

Como a tela descobre o que pode oferecer — e por que ela nunca decide sozinha.

---

## A regra

```text
backend → contrato → Read Model → allowedActions / transitions → interface
```

Nunca:

```text
interface → deduz a regra → oferece a ação → o servidor recusa
```

O frontend não é autoridade de negócio. Isso já valia para autorização — o
servidor responde 403 independentemente do que a tela mostre. O que a PR-FE-01
acrescenta é que também vale para **elegibilidade**: se uma ação cabe agora,
neste registro, quem responde é o Read Model.

## Duas camadas, as duas do servidor

| Camada   | Fonte                                       | Pergunta                     | Onde mora                     |
| -------- | ------------------------------------------- | ---------------------------- | ----------------------------- |
| Sessão   | permissões do papel + capabilities do plano | esta conta poderia, em tese? | `registry/access.ts`          |
| Registro | `allowedActions` do Read Model              | nesta linha, agora, pode?    | `registry/allowed-actions.ts` |

A primeira esconde o que nunca se aplica à conta. A segunda decide o que se
aplica **aqui**. Elas se somam; nenhuma substitui a outra.

### Por que a segunda camada precisou existir

Mudar o status de uma ordem de serviço exige `operations.status.update` **e**
participar dela — ser o responsável técnico ou um auxiliar —, a menos que a
pessoa gerencie a carteira. Participação é um fato da linha, não da sessão: o
navegador não tem como saber.

Antes desta PR o menu decidia só pela permissão. Um técnico com
`operations.status.update` que não estava escalado via "Alterar status",
clicava, e recebia um 403 sem explicação. O backend já publicava
`allowedActions` com essa regra resolvida; a interface simplesmente não lia.

## Como consumir

```ts
import { actionAuthority } from "@/registry";

const authority = actionAuthority(operation.allowedActions);

const canChangeStatus =
  session.hasPermission("operations.status.update") &&
  authority.permits("CHANGE_STATUS");
```

### Ausência não é negação

Um Read Model que ainda não publica `allowedActions` faz `permits` responder
`true`, e a decisão volta inteira para a camada de sessão — o comportamento
anterior a esta PR. É o que permite adotar o contrato módulo a módulo sem
apagar menus de telas cujo backend ainda não foi atualizado.

`declared` distingue os dois casos quando isso importa.

## Transições

A máquina de estados é do servidor, e ele a publica já resolvida para o status
atual:

```ts
const transitions = availableTransitions(
  detail.data?.transitions,
  operation.status,
);
```

Três respostas, três significados:

| Resposta        | Significa                | A tela faz               |
| --------------- | ------------------------ | ------------------------ |
| lista com itens | destinos válidos agora   | preenche o seletor       |
| lista vazia     | estado final             | diz que não há transição |
| `null`          | o Read Model não publica | busca o detalhe          |

**`null` nunca autoriza cair no enum completo.** Oferecer todos os status e
deixar o backend recusar parece neutralidade — não duplicar a máquina de
estados —, mas empurra para o usuário a descoberta de uma regra que o contrato
entrega pronta.

### Lista e detalhe não são o mesmo Read Model

`OperationListItemReadModel` traz `allowedActions`; só
`OperationDetailsReadModel` traz `transitions`. A listagem é compacta de
propósito no backend.

Tipar uma linha de lista como o detalhe promete um campo que não chega —
`transitions` seria `undefined` em silêncio. Os tipos do frontend refletem a
diferença (`OperationListItem` × `Operation`), e o seletor de status aberto a
partir da listagem busca o detalhe pela mesma query key, servida do cache
quando já existe.

## Disabled ou hidden

| Situação                                                   | Apresentação                         |
| ---------------------------------------------------------- | ------------------------------------ |
| a conta nunca terá a capability                            | escondido                            |
| a conta tem, mas este registro não permite agora           | escondido                            |
| bloqueio temporário que o usuário esperaria poder resolver | desabilitado, com o motivo           |
| o contrato não existe na plataforma                        | declarado indisponível, com o motivo |

`accessBlockReason` produz a frase do terceiro e do quarto caso. Código cru de
backend nunca aparece: `blockedReason` é mapeado para linguagem de negócio.

## O que não fazer

- `if (status === "OPEN") canStart = true` — máquina de estados no cliente.
- `Object.values(StatusEnum)` num seletor de transição.
- Recalcular elegibilidade a partir de campos do registro.
- Tratar ausência de `allowedActions` como negação.
- Esconder uma ação para "proteger" — quem protege é o servidor.

## Onde isto já vale

| Módulo         | `allowedActions`                | `transitions` |
| -------------- | ------------------------------- | ------------- |
| Operações      | consumido                       | consumido     |
| RVT            | publicado, aguarda PR-FE-04     | —             |
| Campo (mobile) | publicado, consumido no Flutter | —             |
| Equipamento/QR | publicado, aguarda PR-FE-05     | —             |

PMOC ainda não tem interface Web (PR-FE-03). Quando tiver, reusa este mesmo
caminho — `pmoc.read-models.ts` já publica `allowedTransitions`.


---

## Verificado em navegador (gate de fechamento)

19 verificações em Chromium contra a pilha real — Next em produção, NestJS sob
`orbit_app` com RLS ativa, sessão por cookie HttpOnly. O que elas travam:

| Gate | O que reprova |
|---|---|
| `e2e/routes.spec.ts` | 17 rotas × 3 viewports; qualquer `console.error`, aviso de hydration ou vazamento horizontal |
| `e2e/server-authority.spec.ts` | o seletor de status voltar a listar o enum completo |
| `e2e/interaction.spec.ts` | controle sem foco visível, diálogo que não devolve o foco, botão de ícone sem nome, enum técnico na tela |
| `e2e/resilience.spec.ts` | 404 com mensagem do backend, erro sem `requestId`, HTML de usuário executado |

O navegador roda em `Europe/Lisbon` de propósito, com a unidade em
`America/Recife`: se alguma data civil passar a depender do relógio do cliente,
a suíte acusa.

### O que ainda não dá para verificar

**Não existe seletor de unidade de negócio na interface.** `setBusinessUnit` é
chamado pelo próprio provider e por dois formulários que escolhem a unidade de
uma ação específica — não há troca de escopo global. O cancelamento de
requisições em voo (`cancelQueries` antes de `removeQueries`) está no lugar e
correto, mas não é acionável por navegação, então nenhum teste de navegador o
exercita. Quando a troca de escopo existir, o teste é direto: atrasar a
resposta da unidade anterior, trocar, e afirmar que a resposta atrasada foi
abortada.
