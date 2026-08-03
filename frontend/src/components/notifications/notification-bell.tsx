"use client";

/**
 * Sino com o contador de não lidas.
 *
 * ## A menor extensão necessária
 *
 * O `Topbar` já tinha um botão de sino — com um ponto **fixo**, sempre aceso,
 * que não vinha de dado algum. A extensão foi trocar esse botão por este
 * componente: mesmo tamanho, mesma variante, mesma posição do indicador. O
 * `Topbar` é componente de layout, não do Design System (`components/ui/**`),
 * que permanece intocado.
 *
 * O ganho não é só o número: o indicador **desaparece quando não há nada não
 * lido**, o que antes não acontecia. Um badge sempre aceso ensina o usuário a
 * ignorá-lo.
 *
 * O contador vem de `unread`, que o backend devolve junto da listagem — não é
 * contado aqui, e não depende do filtro que a central esteja usando.
 */
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/hooks/notifications/use-notifications";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const { unread, error } = useUnreadCount();

  /**
   * Falha de leitura não vira alarme.
   *
   * Sem `notifications.read` no plano, ou com o backend fora, o sino continua
   * navegável e simplesmente não mostra número — é a central que explica o que
   * houve, com o erro do servidor.
   */
  const showCount = !error && unread > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className={cn("relative", className)}
    >
      <Link
        href={ROUTES.notifications}
        aria-label={
          showCount ? `Notificações — ${unread} não lida(s)` : "Notificações"
        }
      >
        <Bell className="size-4" />
        {showCount ? (
          <span
            className={cn(
              "bg-gradient-orbit absolute flex items-center justify-center rounded-full font-medium text-white tabular-nums",
              unread > 9
                ? "top-1 right-0.5 h-4 min-w-4 px-1 text-[10px]"
                : "top-1.5 right-1.5 size-3.5 text-[9px]",
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
