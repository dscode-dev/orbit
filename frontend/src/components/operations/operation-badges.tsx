"use client";

/**
 * Rótulos de status, prioridade e tipo.
 *
 * Um único lugar para a leitura visual dos literais da operação — os
 * componentes não repetem mapas nem `switch`.
 */
import { cn } from "@/lib/utils";
import {
  OPERATION_KIND_LABELS,
  OPERATION_PRIORITY_LABELS,
  OPERATION_STATUS_CLASSES,
  OPERATION_STATUS_LABELS,
} from "@/types/operations";

export function OperationStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        OPERATION_STATUS_CLASSES[status] ??
          "bg-surface-strong text-muted-foreground",
        className,
      )}
    >
      {OPERATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function operationPriorityLabel(priority: string): string {
  return OPERATION_PRIORITY_LABELS[priority] ?? priority;
}

export function operationKindLabel(kind: string): string {
  return OPERATION_KIND_LABELS[kind] ?? kind;
}
