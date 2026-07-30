"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-4 animate-spin text-primary", className)} />
      <span className={label ? "text-sm text-muted-foreground" : "sr-only"}>
        {label ?? "Carregando"}
      </span>
    </span>
  );
}

export function LoadingState({ label = "Carregando dados…" }: { label?: string }) {
  return (
    <div className="glass flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl">
      <Spinner className="size-6" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-strong text-primary">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-base font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
