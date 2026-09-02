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
        title="Formatos de documento"
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
              O formato é escolhido no momento de emitir cada documento, não
              como política geral da organização.
            </p>
          </div>
        )}
      </PanelFrame>

      <PanelFrame
        panelId="settings-documents-policies"
        title="Políticas de emissão e retenção"
        description="Regras aplicadas a todos os documentos"
      >
        <div className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Quando se emite.</strong>{" "}
              Uma execução em rascunho não emite documento: é preciso enviá-la
              para revisão antes. Não é configurável.
            </li>
            <li>
              <strong className="text-foreground">Versionamento.</strong> Cada
              emissão cria uma revisão nova; a anterior permanece. Apenas uma
              fica ativa por vez.
            </li>
            <li>
              <strong className="text-foreground">Distribuição.</strong> Sempre
              por link temporário e pessoal. O arquivo nunca é acessado
              diretamente.
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            <strong>Não há política de expurgo:</strong> um documento revogado
            continua registrado para auditoria, e nada é apagado
            automaticamente.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Assinaturas</strong> são coletadas durante a execução em
            campo, com a localização de quem assinou. Não há política de
            assinatura a configurar: cada modelo declara se pede assinatura.
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
            O local de armazenamento é definido na instalação do Orbit, não
            pela organização.
          </p>
          <p className="text-xs text-muted-foreground">
            Trocar o local de armazenamento no meio da operação tornaria
            inalcançáveis os arquivos já gravados. Por isso a escolha não é
            feita por organização.
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
              hint: "Revisões, conteúdo e situação da emissão",
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
