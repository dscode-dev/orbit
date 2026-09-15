"use client";

/**
 * O aviso de assinatura vencida.
 *
 * ## Uma vez, e sai do caminho
 *
 * A avaliação acaba e a pessoa continua tendo trabalho a fazer — consultar um
 * atendimento antigo, baixar o PMOC que o cliente está cobrando. Um modal que
 * volta a cada navegação transformaria isso numa parede, e a reação a uma
 * parede é fechar a aba, não assinar.
 *
 * Aparece uma vez por sessão do navegador, fecha no Esc e no clique fora, e
 * deixa no lugar dele o selo discreto da topbar — que continua ali enquanto a
 * assinatura estiver vencida, sem interromper nada.
 *
 * ## Doze horas de silêncio, num cookie
 *
 * Num cookie e não em `localStorage`, pela mesma razão do tema: o servidor
 * monta o shell e precisa saber antes de pintar — senão o modal aparece e
 * some na frente de quem já o fechou.
 *
 * Doze horas porque isto é "já li hoje", não uma preferência. Guardar para
 * sempre faria com que quem dispensou o aviso em setembro não fosse mais
 * lembrado em outubro; silenciar só pela aba faria o aviso voltar a cada
 * recarregamento, no meio do trabalho.
 */
import { useState } from "react";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/providers/session-provider";
import { ROUTE_ASSINATURA, dataDeVencimento } from "./subscription-access";
import {
  AVISO_COOKIE,
  AVISO_COOKIE_MAX_AGE,
} from "./subscription-notice-cookie";
import { useAvisoDispensado } from "./subscription-notice-provider";

export function SubscriptionExpiredNotice() {
  const session = useSession();
  const vencida = session.isAuthenticated && !session.subscriptionActive;
  /**
   * O estado inicial vem do cookie lido **no servidor**.
   *
   * Descobrir isso depois da hidratação faria o modal aparecer e sumir na
   * frente de quem já o tinha fechado — o mesmo piscar que o menu e o tema
   * resolvem lendo o cookie no layout raiz.
   */
  const [dispensado, setDispensado] = useState(useAvisoDispensado());

  const dispensar = () => {
    setDispensado(true);
    /* `document.cookie` pode lançar com armazenamento bloqueado. Se não dá
       para lembrar, o aviso volta — que é melhor que quebrar a tela. */
    try {
      document.cookie = `${AVISO_COOKIE}=1; path=/; max-age=${AVISO_COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      /* Silêncio: o estado local já fechou o diálogo desta vez. */
    }
  };

  if (!vencida) return null;

  const venceuEm = dataDeVencimento(session.subscriptionEndsAt);

  return (
    <Dialog
      open={!dispensado}
      onOpenChange={(estado) => !estado && dispensar()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-warning/12 text-warning">
            <CalendarX2 className="size-5" aria-hidden />
          </div>
          <DialogTitle>Sua avaliação gratuita terminou</DialogTitle>
          <DialogDescription>
            {venceuEm
              ? `O período de acesso foi até ${venceuEm}. Escolha um plano para voltar a registrar atendimentos.`
              : "Escolha um plano para voltar a registrar atendimentos."}
          </DialogDescription>
        </DialogHeader>

        {/*
          O que continua funcionando fica dito, e não subentendido.

          Sem isto a pessoa conclui que perdeu o acesso aos próprios dados e o
          primeiro impulso é ligar para o suporte perguntando por eles.
        */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Enquanto isso, você continua podendo:</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>· consultar clientes, atendimentos e o histórico;</li>
            <li>· baixar os documentos e relatórios já emitidos.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            O que fica pausado é criar e alterar registros.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={dispensar}>
            Agora não
          </Button>
          <Button asChild onClick={dispensar}>
            <Link href={ROUTE_ASSINATURA}>Ver planos</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
