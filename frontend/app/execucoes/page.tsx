import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * A listagem global de execuções deixou de existir.
 *
 * ## Por que redirecionar, e não devolver 404
 *
 * O caminho continua sendo alcançável por link salvo, favorito e histórico. Um
 * 404 diria "isto não existe", quando o que existe é outro nome para a mesma
 * coisa: o documento que a pessoa procurava está em **Documentos**, que reúne
 * o que foi emitido por ordem de serviço, PMOC e visita técnica.
 *
 * O deep link por execução (`/execucoes/:id`) **continua funcionando**: ele é
 * usado a partir do cliente, da equipe e do ciclo de PMOC, e apaga-lo quebraria
 * navegação contextual legítima. O que saiu foi a porta de entrada global — a
 * que oferecia um conceito de arquitetura como se fosse área de produto.
 */
export default function ArtifactExecutionsPage() {
  redirect(ROUTES.documents);
}
