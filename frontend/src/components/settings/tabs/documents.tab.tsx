"use client";

/**
 * Configurações de documentos.
 *
 * ## Não altera o Document Engine
 *
 * A PR-19 (Storage & Manifest) e a PR-20 (Rendering Engine) definiram quem
 * decide o quê: o manifest versiona, o renderizador produz, o Storage guarda.
 * Esta aba **lê** o que eles publicam e leva ao lugar onde cada coisa é
 * administrada — não muda comportamento de nenhum dos três.
 *
 * ## Renderizadores vêm do backend
 *
 * `GET /artifact-rendering/metrics` publica os renderizadores disponíveis. A
 * lista é do servidor; o Document Registry só acrescenta apresentação.
 */
import Link from "next/link";
import { ArrowRight, FileStack, HardDrive, PenLine } from "lucide-react";

import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveRenderer } from "@/documents";
import { useAvailableRenderers } from "@/hooks/documents/use-documents";
import { ROUTES } from "@/lib/routes";

export function DocumentsSettingsTab() {
  const metrics = useAvailableRenderers();

  return (
    <div className="max-w-3xl space-y-6">
      <PanelFrame
        panelId="settings-documents-renderers"
        title="Renderizadores"
        description="O que a plataforma sabe produzir"
      >
        {metrics.isPending ? (
          <PanelLoading rows={2} />
        ) : metrics.error ? (
          <PanelError
            error={metrics.error}
            onRetry={() => void metrics.refetch()}
          />
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {metrics.renderers.map((id) => {
                const renderer = resolveRenderer(id);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{renderer.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {renderer.description}
                      </p>
                    </div>
                    <Badge variant="outline">{renderer.format}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {id}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted-foreground">
              A lista vem publicada pelo backend. Escolher o renderizador é do
              momento da emissão, não uma política global — e o servidor recusa
              um identificador que não conhece.
            </p>
          </div>
        )}
      </PanelFrame>

      <PanelFrame
        panelId="settings-documents-policies"
        title="Políticas de emissão e retenção"
        description="O que é decidido pelo servidor"
      >
        <div className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Quando se emite.</strong>{" "}
              Execução em rascunho não emite documento — o servidor responde
              409 e pede a submissão. Não é configurável.
            </li>
            <li>
              <strong className="text-foreground">Versionamento.</strong> Cada
              emissão cria uma revisão nova; a anterior permanece. Só uma fica
              ativa, e quem decide é o manifest.
            </li>
            <li>
              <strong className="text-foreground">Distribuição.</strong> Sempre
              por URL assinada, com prazo curto. O armazenamento nunca é
              endereçado pelo cliente.
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            <strong>Retenção não existe em contrato:</strong> nenhum endpoint
            publica ou aceita política de expurgo. Documento revogado continua
            registrado para auditoria, e nada é apagado automaticamente.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Assinaturas</strong> são capturadas na execução em campo
            (<span className="font-mono">ArtifactExecutionSignature</span>), com
            a geolocalização de quem assinou. Não há política de assinatura a
            configurar — cada template declara se pede assinatura.
          </p>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-documents-storage"
        title="Armazenamento"
        description="Onde os arquivos ficam"
      >
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" aria-hidden />
            O provedor é decidido por ambiente
            (<span className="font-mono">STORAGE_PROVIDER</span>), não pela
            organização.
          </p>
          <p className="text-xs text-muted-foreground">
            É configuração de infraestrutura: trocar o provedor no meio da
            operação deixaria os objetos já gravados inalcançáveis. O contrato
            não expõe nem aceita essa escolha por tenant — e é o certo.
          </p>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-documents-shortcuts"
        title="Onde cada coisa se administra"
        description="Configuração vive junto do que ela configura"
      >
        <ul className="space-y-2">
          {[
            {
              label: "Templates oficiais",
              hint: "Estrutura, campos, versões e publicação",
              href: ROUTES.artifacts,
              icon: PenLine,
            },
            {
              label: "Documentos emitidos",
              hint: "Revisões, conteúdo e estado da renderização",
              href: ROUTES.documents,
              icon: FileStack,
            },
          ].map((item) => (
            <li key={item.href}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between px-3 py-2"
                asChild
              >
                <Link href={item.href}>
                  <span className="flex min-w-0 items-center gap-2 text-left">
                    <item.icon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </PanelFrame>
    </div>
  );
}
