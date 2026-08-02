"use client";

/**
 * Leitura visual dos literais de cliente e do endereço.
 *
 * Um só lugar para status, tipo e endereço. Valor fora do mapa aparece cru —
 * `CustomerStatus` e `CustomerType` são listas fechadas nos contratos, e um
 * valor novo do backend precisa ser visto, não traduzido para "Outro".
 */
import { cn } from "@/lib/utils";
import { ADDRESS_KEYS } from "@/types/customers";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  PROSPECT: "Prospect",
  BLOCKED: "Bloqueado",
};

const STATUS_CLASSES: Readonly<Record<string, string>> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  INACTIVE: "bg-surface-strong text-muted-foreground",
  PROSPECT: "bg-sky-500/15 text-sky-400",
  BLOCKED: "bg-destructive/15 text-destructive",
};

const TYPE_LABELS: Readonly<Record<string, string>> = {
  COMPANY: "Pessoa jurídica",
  INDIVIDUAL: "Pessoa física",
};

export function customerStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function customerTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function CustomerStatusBadge({
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
        STATUS_CLASSES[status] ?? "bg-surface-strong text-muted-foreground",
        className,
      )}
    >
      {customerStatusLabel(status)}
    </span>
  );
}

export interface ReadAddress {
  readonly known: Readonly<Record<string, string>>;
  /** Chaves fora das reconhecidas — exibidas como vieram. */
  readonly extra: Readonly<Record<string, string>>;
  readonly city?: string;
  readonly stateCode?: string;
  readonly line?: string;
}

/**
 * Leitura tolerante do endereço.
 *
 * `Customer.address` é `Json?` **sem esquema** no backend. O leitor reconhece
 * as chaves usuais e mostra o restante como está — não há campo obrigatório a
 * exigir nem formato a impor, e descartar o que não reconhece esconderia dado
 * que a organização gravou de propósito.
 */
export function readAddress(
  address: Record<string, unknown> | null,
): ReadAddress {
  if (!address) return { known: {}, extra: {} };

  const known: Record<string, string> = {};
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(address)) {
    if (value === null || value === undefined || value === "") continue;
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    if ((ADDRESS_KEYS as readonly string[]).includes(key)) known[key] = text;
    else extra[key] = text;
  }

  const line = [known.street, known.number, known.complement, known.district]
    .filter(Boolean)
    .join(", ");

  return {
    known,
    extra,
    city: known.city,
    stateCode: known.stateCode ?? known.state,
    line: line || undefined,
  };
}
