"use client";

/**
 * Certificações de uma pessoa.
 *
 * ## O vencimento é do servidor
 *
 * `expiryStatus` e `daysUntilExpiry` vêm calculados pelo backend, com o mesmo
 * relógio para todos. A tela não compara datas para decidir se alguém está
 * habilitado — decidir isso no cliente deixaria um navegador com data errada
 * transformar um técnico vencido em habilitado, e habilitação é exatamente o
 * tipo de coisa que não pode depender do relógio de quem olha.
 */
import { useState } from "react";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/actions";
import {
  useCertifications,
  useCreateCertification,
  useRemoveCertification,
} from "@/hooks/workforce/use-workforce";
import { formatDateTime } from "@/lib/formatters";
import { CertificationBadge } from "./certification-badge";

export function MemberCertificationsSection({ userId }: { userId: string }) {
  const query = useCertifications({ userId });
  const manage = useAction("team-member.update");

  const create = useCreateCertification(userId);
  const remove = useRemoveCertification();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const items = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        issuer: issuer.trim() || undefined,
        expiresAt: expiresAt || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setIssuer("");
          setExpiresAt("");
          setAdding(false);
        },
      },
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <BadgeCheck className="size-4 text-muted-foreground" aria-hidden />
          Certificações
        </h3>
        {manage.allowed && !adding ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        {query.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma certificação registrada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((certification) => (
              <li
                key={certification.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {certification.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {certification.issuer ?? "Emissor não informado"}
                    {certification.expiresAt
                      ? ` · até ${formatDateTime(certification.expiresAt)}`
                      : ""}
                  </p>
                </div>

                <CertificationBadge
                  status={certification.expiryStatus}
                  daysUntilExpiry={certification.daysUntilExpiry}
                />

                {manage.allowed ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${certification.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(certification.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form
            onSubmit={submit}
            className="space-y-3 border-t border-border pt-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="certification-name">Certificação</Label>
                <Input
                  id="certification-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: NR-35 Trabalho em Altura"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="certification-issuer">Emissor</Label>
                <Input
                  id="certification-issuer"
                  value={issuer}
                  onChange={(event) => setIssuer(event.target.value)}
                  placeholder="Ex.: SENAI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="certification-expires">Válida até</Label>
                <Input
                  id="certification-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <MutationError error={create.error} />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        ) : null}

        <MutationError error={remove.error} />
      </div>
    </section>
  );
}
