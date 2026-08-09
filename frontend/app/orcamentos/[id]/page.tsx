import { QuoteWorkspace } from "@/components/quotes/quote-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Detalhe da proposta.
 *
 * Server Component: resolve o parâmetro; o `WorkspacePage` compõe guards e
 * shell. `header={false}` porque o cabeçalho mostra o registro — código,
 * situação, cliente — e só o cliente conhece esses dados.
 */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="quote"
      header={false}
      suspense={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("quote", "Proposta")} />}
    >
      <QuoteWorkspace quoteId={id} />
    </WorkspacePage>
  );
}
