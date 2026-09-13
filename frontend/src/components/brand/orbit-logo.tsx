"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Dois arquivos, dois usos.
 *
 * `orbit_logo` é o logotipo completo — símbolo mais palavra. `orbit_mark` é só
 * o símbolo, e existe porque o "mark" era um **recorte** do logotipo: um zoom
 * de 2,1× ancorado em 22% da largura, torcendo para a palavra ficar fora do
 * quadro. Qualquer reexportação do logotipo movia o enquadramento, e num
 * contêiner redondo o resultado era texto cortado girando dentro do círculo.
 */
const LOGOTIPO = "/orbit_logo.png";
const SIMBOLO = "/orbit_mark.png";

type OrbitLogoProps = {
  /** full lockup (mark + wordmark) or compact mark plate */
  variant?: "full" | "mark";
  className?: string;
};

/**
 * Official Orbit logo. Never redraw or recolor it — the artwork is navy on
 * light, so it sits on a light plate: white in the light theme, and a light
 * plate in dark mode to keep contrast.
 */
export function OrbitLogo({ variant = "full", className }: OrbitLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border dark:bg-foreground/95",
        variant === "full" ? "h-11 w-40 px-3" : "h-10 w-10",
        className,
      )}
    >
      {variant === "full" ? (
        <Image
          src={LOGOTIPO}
          alt="Orbit Operations ERP"
          width={1536}
          height={1024}
          className="h-full w-full object-contain"
        />
      ) : (
        /*
          O símbolo inteiro, sem recorte.
          `p-1` dá a folga que impede o anel do símbolo de encostar na borda do
          contêiner — ele é redondo e o contêiner também.
        */
        <Image
          src={SIMBOLO}
          alt="Orbit"
          width={512}
          height={512}
          className="h-full w-full object-contain p-1"
        />
      )}
    </span>
  );
}
