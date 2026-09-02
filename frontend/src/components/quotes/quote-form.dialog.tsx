"use client";

/**
 * Criação de proposta.
 *
 * O orçamento nasce **vazio**, em rascunho, com numeração do servidor — é o
 * que `CreateQuoteDto` aceita, e nada além. Itens entram depois, no editor:
 * mandá-los no mesmo payload tornaria impossível dizer qual deles falhou.
 *
 * ## Busca de cliente pelo servidor
 *
 * A lista de clientes é paginada e filtrada por `search` no backend. Um
 * `<select>` com todos os clientes carregados de uma vez funcionaria com trinta
 * e quebraria com três mil — e o contrato já oferece a busca certa.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCustomersList } from "@/hooks/customers/use-customers";
import { useCreateQuote } from "@/hooks/quotes/use-quotes";
import { useActiveScope } from "@/providers/use-active-scope";
import { entityHref } from "@/entities";
import { cn } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS } from "@/workspace";
import type { CreateQuoteInput } from "@/types/quotes";

/** Validade sugerida: trinta dias — o padrão comercial mais comum. */
function defaultValidity(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function QuoteFormDialog({
  open,
  onOpenChange,
  /** Cliente já decidido — quando o formulário abre de dentro do cliente. */
  customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <Body onOpenChange={onOpenChange} fixedCustomerId={customerId} />
      </DialogContent>
    </Dialog>
  );
}

function Body({
  onOpenChange,
  fixedCustomerId,
}: {
  onOpenChange: (open: boolean) => void;
  fixedCustomerId?: string;
}) {
  const router = useRouter();
  const { businessUnits, businessUnitId } = useActiveScope();
  const create = useCreateQuote();

  const [customer, setCustomer] = useState(fixedCustomerId ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidity);
  const [unit, setUnit] = useState(businessUnitId ?? "");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input: CreateQuoteInput = {
      customerId: customer,
      businessUnitId: unit || undefined,
      title: title.trim(),
      notes: notes.trim() || undefined,
      validUntil: validUntil || undefined,
    };
    create.mutate(input, {
      onSuccess: (quote) => {
        onOpenChange(false);
        /** Criada vazia: o lugar de continuar é o editor. */
        const href = entityHref("quote", quote.id);
        if (href) router.push(href);
      },
    });
  };

  const incomplete = !customer || title.trim().length < 3 || !unit;

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Novo orçamento</DialogTitle>
        <DialogDescription>
          A proposta nasce em rascunho e vazia. Os itens entram em seguida, e os valores são calculados automaticamente.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {fixedCustomerId ? null : (
          <CustomerPicker value={customer} onChange={setCustomer} />
        )}

        <div className="space-y-2">
          <Label htmlFor="quote-title">Título</Label>
          <Input
            id="quote-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={220}
            placeholder="Ex.: Manutenção preventiva anual — 12 equipamentos"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quote-valid-until">Validade</Label>
            <Input
              id="quote-valid-until"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Obrigatória para enviar: sem prazo, o preço de hoje valeria para
              sempre.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-unit">Unidade</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger id="quote-unit">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {businessUnits.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.tradeName ?? option.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quote-notes">Observações</Label>
          <Textarea
            id="quote-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Condições, prazos de execução, o que está incluso."
          />
        </div>
      </div>

      <MutationError error={create.error} />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={incomplete || create.isPending}>
          {create.isPending ? "Criando…" : "Criar e adicionar itens"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Escolha do cliente, com busca no servidor.
 *
 * Não é um `Select` porque a lista é grande e paginada. O termo digitado vira
 * `search` no contrato de clientes, depois do mesmo intervalo que o resto da
 * aplicação usa.
 */
function CustomerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  /** Uma tecla não é uma requisição — o mesmo intervalo do Workspace Core. */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const query = useCustomersList({ search: search || undefined, limit: 8 });
  const customers = query.data?.data ?? [];

  return (
    <div className="space-y-2">
      <Label htmlFor="quote-customer">Cliente</Label>
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="quote-customer"
          className="pl-9"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por nome ou documento"
          autoComplete="off"
        />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
        {query.isPending ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : customers.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {customers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => onChange(customer.id)}
                  aria-pressed={customer.id === value}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                    customer.id === value
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-surface-strong",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {customer.tradeName ?? customer.legalName}
                    </span>
                    {customer.documentNumber ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {customer.documentNumber}
                      </span>
                    ) : null}
                  </span>
                  {customer.id === value ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

