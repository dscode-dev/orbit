"use client";

/**
 * Autenticação em dois fatores.
 *
 * ## Já existia no backend
 *
 * `POST /identity/me/mfa/enrollment` devolve `factorId`, `secret` e uma URI
 * `otpauth://`; `POST /mfa/enable` confirma com o código; `DELETE /mfa`
 * desativa. Esta PR apenas passou a consumi-los — nenhum contrato foi criado.
 *
 * ## O segredo aparece uma vez
 *
 * Cada chamada de `enrollment` gera um **fator novo**. Por isso é mutação, não
 * consulta: um `useQuery` a dispararia ao montar e trocaria o segredo debaixo
 * de quem estava no meio do cadastro.
 *
 * ## Sem gerar o QR aqui
 *
 * A URI `otpauth://` é o conteúdo do código. Desenhá-la como QR exigiria uma
 * biblioteca de renderização que o Design System não tem — e o segredo em
 * base32, que a tela mostra, é o que qualquer aplicativo autenticador aceita
 * digitado.
 */
import { useState } from "react";
import { ShieldCheck, ShieldPlus } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useBeginMfaEnrollment,
  useDisableMfa,
  useEnableMfa,
} from "@/hooks/profile/use-profile";
import type { MfaEnrollment } from "@/types/settings";

export function MfaSection({ enabled }: { enabled: boolean }) {
  const begin = useBeginMfaEnrollment();
  const enable = useEnableMfa();
  const disable = useDisableMfa();

  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");

  if (enabled) {
    return (
      <section className="glass-panel space-y-3 rounded-xl p-5">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
          Autenticação em dois fatores
          <Badge variant="secondary">ativa</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          Sua conta pede um código do aplicativo autenticador a cada novo
          acesso.
        </p>

        <MutationError error={disable.error} />

        <Button
          variant="outline"
          size="sm"
          disabled={disable.isPending}
          onClick={() => disable.mutate()}
        >
          {disable.isPending ? "Desativando…" : "Desativar"}
        </Button>
      </section>
    );
  }

  return (
    <section className="glass-panel space-y-4 rounded-xl p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ShieldPlus className="size-4 text-muted-foreground" aria-hidden />
          Autenticação em dois fatores
        </h2>
        <p className="text-xs text-muted-foreground">
          Um código do aplicativo autenticador passa a ser exigido junto da
          senha.
        </p>
      </div>

      {enrollment ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-sm">
              Cadastre este segredo no seu aplicativo autenticador:
            </p>
            <p className="font-mono text-sm break-all select-all">
              {enrollment.secret}
            </p>
            <p className="text-xs break-all text-muted-foreground select-all">
              {enrollment.uri}
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              enable.mutate(
                { factorId: enrollment.factorId, code: code.trim() },
                {
                  onSuccess: () => {
                    setEnrollment(null);
                    setCode("");
                  },
                },
              );
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código do aplicativo</Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-32 font-mono"
              />
            </div>

            <Button type="submit" disabled={!code.trim() || enable.isPending}>
              {enable.isPending ? "Confirmando…" : "Ativar"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEnrollment(null);
                setCode("");
              }}
            >
              Cancelar
            </Button>
          </form>

          <MutationError error={enable.error} />
        </div>
      ) : (
        <>
          <MutationError error={begin.error} />
          <Button
            variant="outline"
            size="sm"
            disabled={begin.isPending}
            onClick={() =>
              begin.mutate(undefined, { onSuccess: setEnrollment })
            }
          >
            {begin.isPending ? "Gerando…" : "Configurar"}
          </Button>
        </>
      )}
    </section>
  );
}
