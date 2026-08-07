"use client";

/**
 * Trilha do topo.
 *
 * Cada página escrevia a sua à mão — `<span>Ativos · Workspace</span>`,
 * `<span>Operações · Detalhe</span>` — com separador, maiúsculas e sufixos
 * escolhidos caso a caso. O resultado eram cinco convenções diferentes para a
 * mesma coisa, e nenhuma delas navegável: a trilha era texto, não caminho.
 *
 * Aqui ela vira caminho: os degraus anteriores são links, e o último é o lugar
 * onde se está. Os rótulos vêm dos registries pelo `Navigation Core`.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Crumb } from "./navigation-core";

export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isLast ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
