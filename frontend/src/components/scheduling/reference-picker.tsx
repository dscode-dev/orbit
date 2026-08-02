"use client";

/**
 * Seletor de cliente ou ativo.
 *
 * Combina `Popover` e `Command` — ambos já no Design System — no padrão de
 * combobox com busca. A busca viaja para o servidor (`?search=`), então a
 * lista não é recortada no cliente e encontra registros além dos cem
 * primeiros.
 *
 * Quando o plano não inclui a capability do módulo consultado, o backend
 * responde 403: o seletor declara a indisponibilidade em vez de aparecer
 * vazio, o que sugeriria que a organização não tem clientes cadastrados.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { QueryKey } from "@/api/query-keys";
import type { PaginatedResult } from "@/types/api";

export interface ReferenceOption {
  id: string;
  label: string;
  hint?: string | null;
}

export function ReferencePicker<TItem>({
  id,
  label,
  placeholder,
  value,
  selectedLabel,
  queryKey,
  fetcher,
  toOption,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string | undefined;
  /** Rótulo já conhecido do valor escolhido, para não piscar o id. */
  selectedLabel?: string;
  queryKey: (search?: string) => QueryKey;
  fetcher: (
    search: string | undefined,
    options: { signal: AbortSignal },
  ) => Promise<PaginatedResult<TItem>>;
  toOption: (item: TItem) => ReferenceOption;
  onChange: (id: string | undefined, label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = useApiQuery(
    queryKey(search || undefined),
    ({ signal }) => fetcher(search || undefined, { signal }),
    { enabled: open, staleTime: 60_000 },
  );

  const forbidden = query.error instanceof ApiError && query.error.isForbidden;
  const options = (query.data?.data ?? []).map(toOption);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {value ? (selectedLabel ?? value.slice(0, 8)) : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {forbidden ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Lock className="size-4" aria-hidden />
                  Seu plano não inclui este módulo.
                </div>
              ) : query.isPending ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">
                  Carregando…
                </div>
              ) : query.error ? (
                <div className="px-3 py-6 text-sm text-destructive">
                  {query.error.message}
                </div>
              ) : (
                <>
                  <CommandEmpty>Nada encontrado.</CommandEmpty>
                  <CommandGroup>
                    {value ? (
                      <CommandItem
                        value="__clear__"
                        onSelect={() => {
                          onChange(undefined);
                          setOpen(false);
                        }}
                      >
                        Limpar seleção
                      </CommandItem>
                    ) : null}
                    {options.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.id}
                        onSelect={() => {
                          onChange(option.id, option.label);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "size-4",
                            value === option.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {option.hint}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
