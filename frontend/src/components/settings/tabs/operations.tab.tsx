"use client";

/**
 * Configurações operacionais.
 *
 * ## O único parâmetro real
 *
 * `Organization.settings` é `Json?` **livre** — não há esquema, nem validação,
 * nem catálogo de parâmetros no backend. A autorização de operações atribuídas
 * (PR-12) grava em `settings.operations.requireAssignmentAuthorization`, e é a
 * única chave que a plataforma de fato lê.
 *
 * ## O que a tela não faz
 *
 * Não inventa outros parâmetros. Um interruptor de "comportamento das
 * execuções" ou "política padrão do catálogo" gravaria uma chave que nenhum
 * módulo consulta — configuração que não configura nada é pior que ausência,
 * porque quem a liga acredita ter mudado algo.
 */
import { OperationAuthorizationSection } from "@/components/operations/authorization.section";
import { PanelFrame } from "@/components/panels";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";

export function OperationsSettingsTab() {
  return (
    <div className="max-w-3xl space-y-6">
      <OperationAuthorizationSection />

      <PanelFrame
        panelId="settings-operations-parameters"
        title="Outros parâmetros operacionais"
        description="Comportamento de execuções, políticas padrão e catálogo"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            As configurações da organização ficam num conjunto de campos livres (<span className="font-mono">Organization.settings</span>), sem
            esquema nem catálogo de parâmetros. A autorização acima é a única
            chave que a plataforma de fato lê.
          </p>
          <p className="text-xs text-muted-foreground">
            Oferecer outros interruptores aqui gravaria chaves que nenhum módulo
            consulta — quem as ligasse acreditaria ter mudado algo. Cada
            parâmetro novo entra quando o módulo que o obedece existir.
          </p>
          <p className="text-xs text-muted-foreground">
            Regras fixas da plataforma, que não se configuram: mudanças de situação da operação, validação de preenchimento de execução e
            disponibilidade de item do catálogo.
          </p>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-operations-shortcuts"
        title="Onde cada coisa se administra"
        description="Configuração vive junto do que ela configura"
      >
        <ul className="space-y-2">
          {[
            {
              label: "Templates de artefato",
              hint: "Estrutura, versões e publicação",
              href: ROUTES.artifacts,
            },
            {
              label: "Catálogo",
              hint: "Produtos, serviços, categorias e preços",
              href: ROUTES.catalog,
            },
            {
              label: "Equipe",
              hint: "Papéis, permissões, escalas e especialidades",
              href: ROUTES.team,
            },
          ].map((item) => (
            <li key={item.href}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between px-3 py-2"
                asChild
              >
                <Link href={item.href}>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.hint}
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
