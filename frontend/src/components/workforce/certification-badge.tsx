"use client";

/**
 * Situação de vencimento de uma certificação.
 *
 * `expiryStatus` e `daysUntilExpiry` vêm **calculados pelo servidor**. A tela
 * não compara datas: um navegador com relógio errado não pode transformar um
 * técnico vencido em habilitado.
 */
import { cn } from "@/lib/utils";
import { CertificationExpiryStatus } from "@/types/workforce";

const PRESENTATION: Readonly<
  Record<string, { label: string; className: string }>
> = {
  VALID: { label: "Válida", className: "bg-emerald-500/15 text-emerald-400" },
  EXPIRING: { label: "Vence em breve", className: "bg-amber-500/15 text-amber-400" },
  EXPIRED: { label: "Vencida", className: "bg-destructive/15 text-destructive" },
  PERMANENT: {
    label: "Sem prazo",
    className: "bg-surface-strong text-muted-foreground",
  },
};

export function CertificationBadge({
  status,
  daysUntilExpiry,
  className,
}: {
  status: string;
  daysUntilExpiry: number | null;
  className?: string;
}) {
  const presentation =
    PRESENTATION[status] ?? PRESENTATION[CertificationExpiryStatus.PERMANENT];

  const detail =
    daysUntilExpiry === null
      ? null
      : daysUntilExpiry < 0
        ? `há ${Math.abs(daysUntilExpiry)} dia(s)`
        : `em ${daysUntilExpiry} dia(s)`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        presentation.className,
        className,
      )}
    >
      {presentation.label}
      {detail ? <span className="opacity-70">· {detail}</span> : null}
    </span>
  );
}
