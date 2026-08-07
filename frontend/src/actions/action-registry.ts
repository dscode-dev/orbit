/**
 * Action Registry — o catálogo do que se pode fazer com uma entidade.
 *
 * Os outros registries cobrem apresentação: o que uma entidade é, o que uma
 * métrica significa, como um campo se desenha, o que um documento emitido é.
 * Faltava o eixo das **ações** — "criar", "duplicar", "arquivar", "renderizar"
 * — que até aqui vivia como botão escrito à mão em cada tela, cada um
 * repetindo o mesmo trio: qual permissão exige, qual capability exige, e se
 * precisa confirmar.
 *
 * ## O que ele descreve — e o que ele não faz
 *
 * **Ele descreve.** Rótulo, ícone, entidade dona, exigências, se é destrutiva,
 * em que superfícies aparece, e o texto da confirmação.
 *
 * **Ele não executa.** Não há `run` aqui, e a ausência é deliberada: executar
 * exige hooks (`useApiMutation`), e hooks não podem ser chamados de dentro de
 * um objeto literal. Ligar o registry à mutação é trabalho do componente —
 * `useAction(id)` responde "posso oferecer isto?", e o `onClick` continua
 * sendo o hook que a tela já usa.
 *
 * **Ele não autoriza.** Declara o que o backend exige; quem decide é o
 * servidor, que recusa com 403 independentemente do que esteja aqui. O que o
 * registry evita é oferecer um botão que já se sabe que seria recusado.
 *
 * **Ele não sabe regra de negócio.** Se a transição é válida, se o registro
 * pode ser excluído, se o limite do plano foi atingido — sempre do servidor.
 * `destructive` é uma dica de interface (peça confirmação), não uma regra.
 *
 * Ver `docs/action-registry.md`.
 */
import type { ComponentType } from "react";
import {
  Archive,
  CheckCheck,
  Copy,
  Download,
  Eye,
  FileOutput,
  FolderTree,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Undo2,
  UserPlus,
  type LucideProps,
} from "lucide-react";

import { createRegistry, humanizeId, type AccessRequirement } from "@/registry";
import type { EntityId } from "@/entities/entity-registry";

export type ActionIcon = ComponentType<LucideProps>;

/**
 * Onde a ação pode aparecer.
 *
 * A mesma ação tem exigências diferentes conforme a superfície: um botão
 * primário cabe numa tela, um item de menu cabe numa linha de tabela, e a
 * paleta de comandos precisa de um rótulo que faça sentido fora de contexto.
 */
export const ACTION_SURFACES = ["primary", "menu", "row", "palette"] as const;
export type ActionSurface = (typeof ACTION_SURFACES)[number];

/**
 * Famílias de ação, para agrupar menus sem que cada tela invente a sua ordem.
 */
export const ACTION_CATEGORIES = [
  "create",
  "edit",
  "workflow",
  "document",
  "destructive",
] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

export interface ActionDefinition extends AccessRequirement {
  /** `"<entidade>.<verbo>"` — ex.: `"artifact-template.duplicate"`. */
  readonly id: string;
  readonly entity: EntityId;
  readonly label: string;
  readonly description?: string;
  readonly icon: ActionIcon;
  readonly category: ActionCategory;
  readonly surfaces: readonly ActionSurface[];
  /** Pede confirmação antes de executar. */
  readonly destructive?: boolean;
  /** Texto da confirmação — obrigatório quando destrutiva. */
  readonly confirm?: {
    readonly title: string;
    readonly body: string;
    readonly confirmLabel: string;
  };
}

/**
 * Fábrica com os padrões de cada categoria.
 *
 * Ação destrutiva já nasce pedindo confirmação; ação de criação já nasce como
 * botão primário. São os padrões que cada tela vinha repetindo à mão.
 */
function define(
  input: Omit<ActionDefinition, "surfaces" | "destructive"> &
    Partial<Pick<ActionDefinition, "surfaces" | "destructive">>,
): ActionDefinition {
  const destructive = input.destructive ?? input.category === "destructive";
  const surfaces =
    input.surfaces ??
    (input.category === "create"
      ? (["primary", "palette"] as const)
      : (["menu", "row"] as const));

  return { ...input, destructive, surfaces };
}

const DEFINITIONS: readonly ActionDefinition[] = [
  /* ---------------------------------------------------------------- */
  /* Equipamentos (recurso `assets` no backend)                        */
  /* ---------------------------------------------------------------- */
  define({
    id: "asset.create",
    entity: "asset",
    label: "Novo equipamento",
    icon: Plus,
    category: "create",
    permission: "assets.create",
    capability: "assets.manage",
  }),
  define({
    id: "asset.update",
    entity: "asset",
    label: "Editar",
    icon: Pencil,
    category: "edit",
    permission: "assets.update",
    capability: "assets.manage",
  }),
  /**
   * Ativar e desativar são `PATCH /assets/:id` com `status`.
   *
   * `UpdateAssetDto` aceita o campo — é a única forma suportada de mudar o
   * estado, e não existe endpoint dedicado. Declaradas como ações próprias
   * porque é assim que o usuário pensa nelas; a exigência é a mesma da edição.
   */
  define({
    id: "asset.activate",
    entity: "asset",
    label: "Reativar",
    description: "Volta o equipamento para ACTIVE.",
    icon: Power,
    category: "workflow",
    permission: "assets.update",
    capability: "assets.manage",
  }),
  define({
    id: "asset.deactivate",
    entity: "asset",
    label: "Desativar",
    description: "Marca o equipamento como INACTIVE. O histórico permanece.",
    icon: PowerOff,
    category: "workflow",
    permission: "assets.update",
    capability: "assets.manage",
  }),
  define({
    id: "asset.delete",
    entity: "asset",
    label: "Excluir",
    icon: Trash2,
    category: "destructive",
    permission: "assets.delete",
    capability: "assets.manage",
    confirm: {
      title: "Excluir este equipamento?",
      body: "O equipamento deixa de aparecer nas listagens. O histórico de operações e execuções permanece.",
      confirmLabel: "Excluir",
    },
  }),

  /* ---------------------------------------------------------------- */
  /* Operações                                                         */
  /* ---------------------------------------------------------------- */
  define({
    id: "operation.create",
    entity: "operation",
    label: "Nova operação",
    icon: Plus,
    category: "create",
    permission: "operations.create",
    capability: "operations.manage",
  }),
  define({
    id: "operation.update",
    entity: "operation",
    label: "Editar",
    icon: Pencil,
    category: "edit",
    permission: "operations.update",
    capability: "operations.manage",
  }),

  /* ---------------------------------------------------------------- */
  /* Catálogo — produtos, serviços e peças                             */
  /* ---------------------------------------------------------------- */
  define({
    id: "catalog-item.create",
    entity: "catalog-item",
    label: "Novo item",
    description: "Produto, serviço ou peça oferecido pela organização.",
    icon: Plus,
    category: "create",
    permission: "catalog.products.create",
    capability: "catalog.manage",
  }),
  define({
    id: "catalog-item.update",
    entity: "catalog-item",
    label: "Editar",
    icon: Pencil,
    category: "edit",
    permission: "catalog.products.update",
    capability: "catalog.manage",
  }),
  /**
   * Disponibilizar e retirar de circulação.
   *
   * São `PATCH /catalog/products/:id` com `status`. Um item indisponível
   * continua existindo e continua referenciado por registros anteriores —
   * é a diferença entre "não oferecemos mais isto" e "isto nunca existiu".
   */
  define({
    id: "catalog-item.activate",
    entity: "catalog-item",
    label: "Disponibilizar",
    description: "Volta a oferecer o item.",
    icon: Power,
    category: "workflow",
    permission: "catalog.products.update",
    capability: "catalog.manage",
  }),
  define({
    id: "catalog-item.deactivate",
    entity: "catalog-item",
    label: "Retirar de circulação",
    description: "O item deixa de ser oferecido, mas permanece no histórico.",
    icon: PowerOff,
    category: "workflow",
    permission: "catalog.products.update",
    capability: "catalog.manage",
  }),
  define({
    id: "catalog-item.delete",
    entity: "catalog-item",
    label: "Excluir",
    icon: Trash2,
    category: "destructive",
    permission: "catalog.products.delete",
    capability: "catalog.manage",
    confirm: {
      title: "Excluir este item do catálogo?",
      body: "Ele some das listagens. Para apenas parar de oferecê-lo, use \"Retirar de circulação\" — assim o registro permanece.",
      confirmLabel: "Excluir",
    },
  }),
  define({
    id: "catalog-item.create-category",
    entity: "catalog-item",
    label: "Nova categoria",
    icon: FolderTree,
    category: "create",
    surfaces: ["primary"],
    permission: "catalog.categories.create",
    capability: "catalog.manage",
  }),
  define({
    id: "catalog-item.update-category",
    entity: "catalog-item",
    label: "Editar categoria",
    icon: Pencil,
    category: "edit",
    permission: "catalog.categories.update",
    capability: "catalog.manage",
  }),
  define({
    id: "catalog-item.delete-category",
    entity: "catalog-item",
    label: "Excluir categoria",
    icon: Trash2,
    category: "destructive",
    permission: "catalog.categories.delete",
    capability: "catalog.manage",
    confirm: {
      title: "Excluir esta categoria?",
      body: "O servidor recusa se houver subcategorias ou itens vinculados. Nesse caso, mova-os antes.",
      confirmLabel: "Excluir",
    },
  }),

  /* ---------------------------------------------------------------- */
  /* Equipe                                                            */
  /* ---------------------------------------------------------------- */
  define({
    id: "team-member.create",
    entity: "team-member",
    label: "Convidar pessoa",
    description:
      "Envia um convite por e-mail. A pessoa define a própria senha ao aceitar.",
    icon: UserPlus,
    category: "create",
    permission: "identity.invitations.create",
  }),
  define({
    id: "team-member.resend-invitation",
    entity: "team-member",
    label: "Reenviar convite",
    description: "Gera um link novo. O anterior deixa de valer.",
    icon: Send,
    category: "workflow",
    permission: "identity.invitations.create",
  }),
  define({
    id: "team-member.revoke-invitation",
    entity: "team-member",
    label: "Cancelar convite",
    icon: Trash2,
    category: "destructive",
    permission: "identity.invitations.create",
    confirm: {
      title: "Cancelar este convite?",
      body: "O link deixa de funcionar imediatamente. O registro permanece para auditoria, e a pessoa pode ser convidada de novo depois.",
      confirmLabel: "Cancelar convite",
    },
  }),
  /**
   * Editar membro e trocar papel não existem em contrato.
   *
   * Não há `PATCH /organizations/current/members/:id`, e `roleId` só é
   * informado no convite. `available: false` declara a ausência em vez de
   * esconder a ação — quando a rota existir, vira `true` e nada mais muda.
   */
  define({
    id: "team-member.update",
    entity: "team-member",
    label: "Editar membro",
    icon: Pencil,
    category: "edit",
    available: false,
    unavailableReason:
      "O backend não publica edição de membro: nome, e-mail e avatar são do perfil, que cada pessoa administra em identity/me.",
  }),
  define({
    id: "team-member.change-role",
    entity: "team-member",
    label: "Trocar papel",
    icon: ShieldCheck,
    category: "workflow",
    available: false,
    unavailableReason:
      "Não há rota para alterar o papel de um membro. O papel é definido no convite e só muda por lá.",
  }),
  define({
    id: "team-member.deactivate",
    entity: "team-member",
    label: "Desativar membro",
    icon: PowerOff,
    category: "workflow",
    available: false,
    unavailableReason:
      "A coluna de situação da associação existe e é publicada, mas nenhuma rota a escreve.",
  }),

  /* ---------------------------------------------------------------- */
  /* Clientes                                                          */
  /* ---------------------------------------------------------------- */
  define({
    id: "customer.create",
    entity: "customer",
    label: "Novo cliente",
    icon: Plus,
    category: "create",
    permission: "customers.create",
    capability: "crm.manage",
  }),
  define({
    id: "customer.update",
    entity: "customer",
    label: "Editar",
    icon: Pencil,
    category: "edit",
    permission: "customers.update",
    capability: "crm.manage",
  }),

  /* ---------------------------------------------------------------- */
  /* Agenda                                                            */
  /* ---------------------------------------------------------------- */
  define({
    id: "scheduling-event.create",
    entity: "scheduling-event",
    label: "Novo agendamento",
    icon: Plus,
    category: "create",
    permission: "scheduling.events.create",
    capability: "scheduling.manage",
  }),
  define({
    id: "scheduling-event.update",
    entity: "scheduling-event",
    label: "Editar",
    icon: Pencil,
    category: "edit",
    permission: "scheduling.events.update",
    capability: "scheduling.manage",
  }),
  define({
    id: "scheduling-event.delete",
    entity: "scheduling-event",
    label: "Cancelar agendamento",
    icon: Trash2,
    category: "destructive",
    permission: "scheduling.events.delete",
    capability: "scheduling.manage",
    confirm: {
      title: "Cancelar este agendamento?",
      body: "O compromisso sai da agenda. Os participantes não são notificados automaticamente.",
      confirmLabel: "Cancelar agendamento",
    },
  }),

  /* ---------------------------------------------------------------- */
  /* Templates de artefato                                             */
  /* ---------------------------------------------------------------- */
  define({
    id: "artifact-template.create",
    entity: "artifact-template",
    label: "Novo template",
    icon: Plus,
    category: "create",
    permission: "artifact_templates.create",
    capability: "artifact_templates.manage",
  }),
  define({
    id: "artifact-template.duplicate",
    entity: "artifact-template",
    label: "Duplicar",
    description:
      "Cria um rascunho independente com a mesma estrutura. O original não muda.",
    icon: Copy,
    category: "edit",
    permission: "artifact_templates.create",
    capability: "artifact_templates.manage",
  }),
  define({
    id: "artifact-template.publish",
    entity: "artifact-template",
    label: "Publicar versão",
    description: "Congela a estrutura atual como uma nova versão imutável.",
    icon: Send,
    category: "workflow",
    permission: "artifact_templates.update",
    capability: "artifact_templates.manage",
  }),
  define({
    id: "artifact-template.archive",
    entity: "artifact-template",
    label: "Arquivar",
    icon: Archive,
    category: "destructive",
    permission: "artifact_templates.delete",
    capability: "artifact_templates.manage",
    confirm: {
      title: "Arquivar este template?",
      body: "Ele deixa de aparecer para novas execuções. As execuções já criadas continuam válidas.",
      confirmLabel: "Arquivar",
    },
  }),

  /* ---------------------------------------------------------------- */
  /* Execuções                                                         */
  /* ---------------------------------------------------------------- */
  define({
    id: "artifact-execution.create",
    entity: "artifact-execution",
    label: "Nova execução",
    icon: Plus,
    category: "create",
    permission: "artifact_executions.create",
    capability: "artifact_executions.manage",
  }),
  define({
    id: "artifact-execution.submit",
    entity: "artifact-execution",
    label: "Submeter",
    description: "Envia a execução para revisão. O backend valida o preenchimento.",
    icon: CheckCheck,
    category: "workflow",
    permission: "artifact_executions.update",
    capability: "artifact_executions.manage",
  }),
  define({
    id: "artifact-execution.reopen",
    entity: "artifact-execution",
    label: "Reabrir",
    icon: Undo2,
    category: "workflow",
    permission: "artifact_executions.update",
    capability: "artifact_executions.manage",
  }),
  define({
    id: "artifact-execution.render",
    entity: "artifact-execution",
    label: "Renderizar documento",
    description: "Gera uma nova revisão a partir das respostas atuais.",
    icon: FileOutput,
    category: "document",
    permission: "artifact_rendering.render",
    capability: "artifact_rendering.render",
  }),
  define({
    id: "artifact-execution.preview-document",
    entity: "artifact-execution",
    label: "Visualizar documento",
    icon: Eye,
    category: "document",
    permission: "artifact_manifests.read",
    capability: "artifact_manifests.read",
  }),
  define({
    id: "artifact-execution.download-document",
    entity: "artifact-execution",
    label: "Baixar documento",
    icon: Download,
    category: "document",
    permission: "artifact_manifests.read",
    capability: "artifact_manifests.read",
  }),
  define({
    id: "artifact-execution.revoke-document",
    entity: "artifact-execution",
    label: "Revogar documento",
    icon: RefreshCw,
    category: "destructive",
    permission: "artifact_manifests.revoke",
    capability: "artifact_manifests.manage",
    confirm: {
      title: "Revogar esta revisão?",
      body: "O documento deixa de ser distribuído. O registro permanece para auditoria e o motivo é obrigatório.",
      confirmLabel: "Revogar",
    },
  }),
  /**
   * Compartilhar não tem contrato.
   *
   * `available: false` declara a ausência em vez de esconder: a URL assinada é
   * curta e pessoal, e não existe endpoint que crie link público ou envie por
   * e-mail. Quando existir, vira `true` e nada mais muda.
   */
  define({
    id: "artifact-execution.share-document",
    entity: "artifact-execution",
    label: "Compartilhar documento",
    icon: Share2,
    category: "document",
    available: false,
    unavailableReason:
      "Não há contrato de compartilhamento: a URL assinada é curta e pessoal, e não existe endpoint que crie link público ou envie por e-mail.",
  }),
];

const registry = createRegistry<ActionDefinition>({
  name: "actions",
  source: "src/actions/action-registry.ts",
  entries: DEFINITIONS,
  /**
   * Ação destrutiva sem texto de confirmação é erro de declaração.
   *
   * O componente que pede a confirmação lê o texto daqui; sem ele, o diálogo
   * apareceria vazio. Verificado só em desenvolvimento — em produção o pior
   * caso é um diálogo genérico, e não uma tela quebrada.
   */
  validate: (action) =>
    action.destructive && !action.confirm
      ? "ação destrutiva precisa declarar `confirm`"
      : null,
  derive: (id) => ({
    id,
    entity: (id.split(".")[0] ?? "asset") as EntityId,
    label: humanizeId(id.split(".").slice(1).join(".") || id),
    icon: Plus,
    category: "edit",
    surfaces: ["menu"],
    available: false,
    unavailableReason: "Ação ainda não registrada.",
  }),
});

export function allActions(): readonly ActionDefinition[] {
  return registry.all();
}

/** A ação declarada, ou `undefined` — a superfície simplesmente não a oferece. */
export function getAction(id: string): ActionDefinition | undefined {
  return registry.get(id);
}

/** A ação, sempre — derivada e indisponível quando não é declarada. */
export function resolveAction(id: string): ActionDefinition {
  return registry.resolve(id);
}

/** Ações de uma entidade, opcionalmente recortadas por superfície. */
export function actionsFor(
  entity: EntityId,
  surface?: ActionSurface,
): readonly ActionDefinition[] {
  return registry
    .all()
    .filter(
      (action) =>
        action.entity === entity &&
        (surface === undefined || action.surfaces.includes(surface)),
    );
}
