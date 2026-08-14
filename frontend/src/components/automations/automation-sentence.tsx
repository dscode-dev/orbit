"use client";

/**
 * Uma regra, lida como frase.
 *
 * ```
 * Quando   Operação for concluída
 * Se       Tipo é igual a Manutenção
 * Então    Criar lembrete na agenda, em 6 meses
 * ```
 *
 * É a tela inteira do que uma automação é. **Não há canvas, nó ou seta** — uma
 * regra do Orbit não ramifica, não repete e não espera aprovação; desenhá-la
 * como fluxograma prometeria as três coisas. Três linhas de texto dizem tudo o
 * que existe, e o que não existe fica visivelmente ausente.
 *
 * Os rótulos vêm do catálogo do servidor (`triggerLabel`, rótulo da ação) e
 * dos literais de domínio já sincronizados. Quando o gatilho não está no
 * catálogo — porque o backend o removeu —, o tipo cru aparece: uma regra órfã
 * precisa ser vista, não escondida.
 */
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_DELAY_UNIT_LABELS,
  AUTOMATION_DELAY_UNIT_SINGULAR,
  AUTOMATION_EXECUTION_STATUS_CLASSES,
  AUTOMATION_EXECUTION_STATUS_LABELS,
  AUTOMATION_OPERATOR_LABELS,
  automationFieldLabel,
  type AutomationAction,
  type AutomationActionDefinition,
  type AutomationCondition,
  type AutomationRule,
} from "@/types/automations";
import { valueLabel, type ScopeUnit } from "./automation-fields";

/* ------------------------------------------------------------------ */
/* Pedaços                                                             */
/* ------------------------------------------------------------------ */

/** "em 6 meses", "em 1 mês", ou nada quando a ação é imediata. */
export function delayPhrase(action: AutomationAction): string | null {
  if (!action.delay) return null;
  const { amount, unit } = action.delay;
  const label =
    amount === 1
      ? (AUTOMATION_DELAY_UNIT_SINGULAR[unit] ?? unit)
      : (AUTOMATION_DELAY_UNIT_LABELS[unit] ?? unit);
  return `em ${amount} ${label}`;
}

export function conditionPhrase(
  condition: AutomationCondition,
  entityType: string,
  units: readonly ScopeUnit[],
): string {
  const field = automationFieldLabel(condition.field);
  const operator =
    AUTOMATION_OPERATOR_LABELS[condition.operator] ?? condition.operator;

  if (condition.operator === "exists") return `${field} ${operator}`;

  const raw = condition.value;
  const values = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const labels = values.map((value) =>
    valueLabel(entityType, condition.field, value, units),
  );

  if (labels.length === 0) return `${field} ${operator} —`;
  if (labels.length === 1) return `${field} ${operator} ${labels[0]}`;
  return `${field} ${operator} ${labels.slice(0, -1).join(", ")} ou ${
    labels[labels.length - 1]
  }`;
}

export function actionPhrase(
  action: AutomationAction,
  definition: AutomationActionDefinition | undefined,
): string {
  const label = definition?.label ?? action.type;
  const delay = delayPhrase(action);
  return delay ? `${label}, ${delay}` : label;
}

/* ------------------------------------------------------------------ */
/* A frase                                                             */
/* ------------------------------------------------------------------ */

function Line({
  keyword,
  children,
}: {
  keyword: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {keyword}
      </span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

export function AutomationSentence({
  rule,
  entityType,
  actionDefinitions,
  units,
  className,
}: {
  rule: Pick<AutomationRule, "trigger" | "triggerLabel" | "conditions" | "actions">;
  /** `entityType` do gatilho publicado — decide o vocabulário dos valores. */
  entityType: string;
  actionDefinitions: readonly AutomationActionDefinition[];
  units: readonly ScopeUnit[];
  className?: string;
}) {
  const definitionFor = (type: string) =>
    actionDefinitions.find((definition) => definition.type === type);

  return (
    <div className={cn("space-y-2", className)}>
      <Line keyword="Quando">
        {rule.triggerLabel ?? (
          <span className="font-mono text-xs">{rule.trigger}</span>
        )}
      </Line>

      <Line keyword="Se">
        {rule.conditions.length === 0 ? (
          <span className="text-muted-foreground">
            Sempre — sem condição, a regra vale para todo evento deste tipo.
          </span>
        ) : (
          <ul className="space-y-1">
            {rule.conditions.map((condition, index) => (
              <li key={`${condition.field}-${condition.operator}-${index}`}>
                {index > 0 ? (
                  <span className="mr-1 text-xs text-muted-foreground uppercase">
                    e
                  </span>
                ) : null}
                {conditionPhrase(condition, entityType, units)}
              </li>
            ))}
          </ul>
        )}
      </Line>

      <Line keyword="Então">
        <ul className="space-y-1">
          {rule.actions.map((action) => {
            const definition = definitionFor(action.type);
            return (
              <li key={action.id} className="flex flex-wrap items-center gap-2">
                <span>{actionPhrase(action, definition)}</span>
                {action.available ? null : (
                  <Badge
                    variant="outline"
                    className="border-warning/40 text-warning"
                  >
                    Indisponível
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Line>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marcas                                                              */
/* ------------------------------------------------------------------ */

export function RuleStateBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        enabled
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-surface-strong text-muted-foreground",
      )}
    >
      {enabled ? "Ativa" : "Desativada"}
    </Badge>
  );
}

export function ScopeBadge({
  businessUnit,
}: {
  businessUnit: { id: string; name: string } | null;
}) {
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      {businessUnit ? businessUnit.name : "Toda a organização"}
    </Badge>
  );
}

export function ExecutionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        AUTOMATION_EXECUTION_STATUS_CLASSES[status] ??
          "bg-surface-strong text-muted-foreground",
      )}
    >
      {AUTOMATION_EXECUTION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
