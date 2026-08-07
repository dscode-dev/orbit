import { CustomersList } from "@/components/customers/customers-list";
import { WorkspacePage } from "@/workspace";

/**
 * Clientes — listagem.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. Rótulo,
 * descrição e capability saem do Entity Registry — os mesmos valores que o
 * guard usa e que o backend exige em `@Capabilities('crm.read')`.
 */
export default function CustomersPage() {
  return (
    <WorkspacePage entity="customer">
      <CustomersList />
    </WorkspacePage>
  );
}
