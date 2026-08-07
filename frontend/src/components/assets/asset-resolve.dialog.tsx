"use client";

/**
 * Localizar equipamento pelo identificador.
 *
 * Consome `GET /assets/resolve/:identifier` — o mesmo endpoint que o
 * aplicativo de campo usa ao ler um QR Code, uma etiqueta ou uma tag NFC. É a
 * ponte entre o mundo físico e a tela: quem está diante da máquina digita (ou
 * cola) o que está impresso nela e chega ao registro.
 *
 * ## Sem leitor de câmera
 *
 * A leitura óptica é do aplicativo móvel, que tem a câmera e a permissão. Aqui
 * o campo aceita o **conteúdo** do código — que é o que o backend resolve. Um
 * leitor no navegador seria uma segunda implementação do mesmo contrato, com
 * mais superfície de erro e nenhum ganho para quem está no escritório.
 *
 * ## A busca só acontece quando pedida
 *
 * `enabled` fica falso até o envio: resolver a cada tecla geraria uma consulta
 * por caractere, e cada uma delas um 404 legítimo. O 404 aqui não é falha — é
 * a resposta "não existe esse identificador nesta organização", e a tela o
 * traduz assim.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Search } from "lucide-react";

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
import { Spinner } from "@/components/feedback/states";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { CACHE } from "@/hooks/api/cache-policy";
import { assetsService } from "@/services/assets.service";
import { entityHref } from "@/entities";
import { ApiError } from "@/lib/api-error";

export function AssetResolveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const query = useApiQuery(
    assetsService.keys.resolve(submitted),
    ({ signal }) => assetsService.resolve(submitted, { signal }),
    {
      enabled: open && submitted.length > 0,
      /** O vínculo identificador → equipamento muda por reetiquetagem, não sozinho. */
      ...CACHE.stable,
      retry: false,
    },
  );

  const notFound = query.error instanceof ApiError && query.error.isNotFound;

  const open_ = (id: string) => {
    const href = entityHref("asset", id);
    onOpenChange(false);
    if (href) router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(term.trim());
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>Localizar equipamento</DialogTitle>
            <DialogDescription>
              Informe o conteúdo do QR Code, da etiqueta ou da tag NFC gravado
              no equipamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="asset-resolve-identifier">Identificador</Label>
            <div className="relative">
              <QrCode
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="asset-resolve-identifier"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ex.: ORB-HVAC-0042"
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A leitura pela câmera é feita pelo aplicativo de campo. Aqui vale
              o conteúdo do código.
            </p>
          </div>

          {submitted && query.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Procurando…
            </p>
          ) : null}

          {notFound ? (
            <p className="rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm text-muted-foreground">
              Nenhum equipamento com este identificador nesta organização.
              Confira o código impresso ou cadastre o equipamento.
            </p>
          ) : null}

          {query.error && !notFound ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {query.error.message}
            </p>
          ) : null}

          {query.data ? (
            <button
              type="button"
              onClick={() => open_(query.data.id)}
              className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-surface-strong"
            >
              <p className="font-medium">{query.data.name}</p>
              <p className="text-xs text-muted-foreground">
                {[query.data.manufacturer, query.data.model, query.data.location]
                  .filter(Boolean)
                  .join(" · ") || "Sem dados técnicos"}
              </p>
              {query.data.customer ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cliente:{" "}
                  {query.data.customer.tradeName ??
                    query.data.customer.legalName}
                </p>
              ) : null}
            </button>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
            <Button type="submit" disabled={!term.trim()}>
              <Search className="size-4" />
              Localizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
