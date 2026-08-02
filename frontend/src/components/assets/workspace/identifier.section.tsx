"use client";

/**
 * Identificação do ativo e QR Code.
 *
 * O QR codifica `asset.identifier` — o mesmo payload que
 * `GET /assets/resolve/:identifier` resolve de volta para o ativo. Ou seja: o
 * código impresso na etiqueta e colado no equipamento leva a esta tela, e é
 * por isso que o painel existe.
 *
 * ## Sobre a dependência
 *
 * `qrcode.react` é a única biblioteca externa acrescentada. A justificativa é
 * que codificar um QR é um algoritmo fechado (correção de erro Reed-Solomon,
 * máscaras, versões) — não é regra de negócio, não é apresentação que o
 * Design System cubra, e escrevê-lo à mão seriam centenas de linhas sem
 * benefício. Ela roda **no navegador**, sem serviço externo: nenhum dado do
 * ativo sai da máquina para virar imagem.
 *
 * Fica encapsulada aqui: nenhum outro arquivo a importa.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode } from "lucide-react";

import { PanelFrame } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSET_IDENTIFIER_LABELS } from "@/entities";
import type { Asset } from "@/types/assets";

export function IdentifierSection({ asset }: { asset: Asset }) {
  const [copied, setCopied] = useState(false);
  const payload = asset.identifier ?? asset.serialNumber;

  return (
    <PanelFrame
      panelId="asset-identifier"
      title="Identificação"
      description="Etiqueta física do equipamento"
      actions={
        asset.identifierType ? (
          <Badge variant="secondary">
            {ASSET_IDENTIFIER_LABELS[asset.identifierType] ??
              asset.identifierType}
          </Badge>
        ) : null
      }
    >
      {payload ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={payload} size={132} level="M" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {asset.identifier ? "Identificador" : "Número de série"}
              </p>
              <p className="font-mono text-sm break-all">{payload}</p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(payload).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Este código resolve para o ativo em
              <code className="mx-1">/assets/resolve/:identifier</code>, a rota
              usada pela leitura em campo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
          <QrCode className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Este ativo não tem identificador nem número de série cadastrado.
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Sem um deles não há o que codificar — o QR representa o payload
            gravado no cadastro, não um valor gerado aqui.
          </p>
        </div>
      )}
    </PanelFrame>
  );
}
