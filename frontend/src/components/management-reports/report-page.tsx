"use client";

/**
 * A tela de um relatório.
 *
 * Existe para separar o que é **navegação** — voltar, gerar de novo — do que é
 * **conteúdo**, que é o `ReportDetail`. A repetição leva ao gerador com o tipo
 * já escolhido; não existe rota que recomponha um relatório, e não deveria
 * existir: o snapshot é imutável, e é essa imutabilidade que o torna prova.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { ReportDetail } from "./report-detail";

export function ReportPage({ reportId }: { reportId: string }) {
  const router = useRouter();

  return (
    <ContentContainer size="wide" className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={ROUTES.managementReports}>
          <ArrowLeft className="size-4" />
          Relatórios
        </Link>
      </Button>

      <ReportDetail
        reportId={reportId}
        onRepeat={(report) =>
          /**
           * O tipo viaja na URL, e o gerador o pré-seleciona.
           *
           * Os demais parâmetros não: período e recorte são escolhas de quem
           * está pedindo agora, e herdá-los silenciosamente produziria um
           * "relatório novo" que é a cópia do antigo sem que ninguém tenha
           * decidido isso.
           */
          router.push(
            `${ROUTES.managementReports}?tipo=${encodeURIComponent(report.type)}`,
          )
        }
      />
    </ContentContainer>
  );
}
