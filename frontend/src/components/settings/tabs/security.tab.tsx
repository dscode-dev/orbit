"use client";

/**
 * Segurança da plataforma.
 *
 * ## Sessão é pessoal, e o contrato deixa isso claro
 *
 * `GET /identity/me/sessions` lista os dispositivos de **quem consulta**. Não
 * há rota que liste as sessões da organização, e não é um descuido: expor os
 * dispositivos de todo mundo a quem administra a conta é uma decisão de
 * privacidade que o backend não tomou.
 *
 * Esta aba mostra o que **é** da organização — o que o servidor decide sobre
 * autenticação — e leva ao Perfil para o que é pessoal.
 *
 * ## Nada de autenticação aqui
 *
 * Nenhuma política é aplicada nesta tela. Expiração de token, tentativas antes
 * do bloqueio e exigência de MFA são decididas pelo servidor e não publicadas
 * em contrato nenhum — o que está escrito abaixo é descrição do
 * comportamento observado, não configuração.
 */
import Link from "next/link";
import { ArrowRight, KeyRound, Lock, ShieldAlert, Users } from "lucide-react";

import { PanelFrame } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/providers/session-provider";

export function SecuritySettingsTab() {
  const session = useSession();

  return (
    <div className="max-w-3xl space-y-6">
      <PanelFrame
        panelId="settings-security-sessions"
        title="Sessões e dispositivos"
        description="Onde cada coisa é administrada"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O contrato de sessões é <strong>pessoal</strong>:
            <span className="font-mono"> /identity/me/sessions</span> lista os
            dispositivos de quem consulta. Não há rota que liste as sessões da
            organização.
          </p>
          <p className="text-xs text-muted-foreground">
            Não é descuido: expor os dispositivos de todo mundo a quem
            administra a conta é decisão de privacidade que o backend não tomou.
            Quem precisa tirar alguém de circulação o faz pela situação do
            membro, na Equipe.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={ROUTES.profile}>
                <KeyRound className="size-4" />
                Minhas sessões
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.team}>
                <Users className="size-4" />
                Situação dos membros
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-security-policies"
        title="Políticas de autenticação"
        description="O que o servidor decide"
      >
        <div className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Lock
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>
                <strong className="text-foreground">Senha</strong> — mínimo de
                12 caracteres, exigido no cadastro, na recuperação e na troca.
                Trocar a senha encerra as demais sessões.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldAlert
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>
                <strong className="text-foreground">
                  Bloqueio por tentativas
                </strong>{" "}
                — o servidor conta as falhas e bloqueia a credencial. O limite e
                a duração não são publicados.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <KeyRound
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>
                <strong className="text-foreground">Dois fatores</strong> — está
                disponível e é <strong>opcional por pessoa</strong>. Não há como
                exigi-lo para toda a organização.
              </span>
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            Nenhum destes parâmetros é configurável: o backend não publica nem
            aceita política de segurança por organização. Esta lista descreve o
            comportamento, não o configura.
          </p>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-security-audit"
        title="Auditoria e histórico de acesso"
        description="O que existe e o que não é publicado"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O servidor grava auditoria (<span className="font-mono">audit_logs</span>,
            com tipo de entidade, ação, antes e depois), mas{" "}
            <strong>nenhuma rota a expõe para a organização</strong> —
            verificado.
          </p>
          <p className="text-xs text-muted-foreground">
            De histórico de acesso, o que existe é quando cada sessão começou.
            Nada é reconstruído aqui: uma linha do tempo montada a partir das
            sessões pareceria completa sem ser.
          </p>
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="settings-security-context"
        title="Autorização em vigor"
        description="Como o backend decide cada requisição"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Plano</span>
            <Badge variant="outline">
              {session.entitlements?.planKey ?? "—"}
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {session.capabilities.length} capabilities
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {session.permissions.length} permissões
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Toda requisição passa por dois crivos: a{" "}
            <strong>permissão</strong>, que vem do papel, e a{" "}
            <strong>capability</strong>, que vem do plano. Papéis se administram
            na Equipe; capabilities dependem do plano contratado.
          </p>

          <Button variant="ghost" size="sm" asChild>
            <Link href={ROUTES.profile}>
              Ver as minhas permissões efetivas
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </PanelFrame>
    </div>
  );
}
