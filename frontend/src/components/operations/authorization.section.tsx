"use client";

/**
 * Autorização de operações atribuídas.
 *
 * ## O que existe hoje, com precisão
 *
 * A **preferência é persistida de verdade**: `Organization.settings` é um JSON
 * livre publicado em `GET /organizations/current` e aceito por
 * `PATCH /organizations/current`. A chave gravada é
 * `operations.requireAssignmentAuthorization`, e o padrão é **desligado**.
 *
 * A **aplicação da regra não existe**. Nenhum ponto do backend lê essa chave:
 *
 * - `OperationQueryDto` não filtra por "autorizada";
 * - `Operation` não tem campo de autorização — o `status` vai de `OPEN` a
 *   `CANCELLED` sem etapa intermediária;
 * - `POST /operations/:id/assignments` atribui e pronto, sem estado pendente.
 *
 * Ou seja: ligar a chave **não esconde nada de ninguém ainda**. A tela diz
 * isso com todas as letras em vez de fingir um fluxo que não acontece —
 * esconder operações no cliente seria pior: o técnico continuaria vendo tudo
 * pelo aplicativo e pela API.
 *
 * ## Por que gravar mesmo assim
 *
 * Porque a decisão é do Owner e precisa sobreviver ao navegador. Quando o
 * backend passar a ler a chave, quem já configurou não reconfigura. A proposta
 * de evolução mínima — um `authorizedAt` na operação e um filtro no
 * `OperationQueryDto` — está em `docs/ux-improvements.md`.
 */
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { Switch } from "@/components/ui/switch";
import {
  useOrganization,
  useUpdateOrganization,
} from "@/hooks/organization/use-organization";
import { useSession } from "@/providers/session-provider";
import type { Organization } from "@/types/organization";

/** Caminho da preferência dentro de `settings`. */
const SETTINGS_NAMESPACE = "operations";
const SETTINGS_KEY = "requireAssignmentAuthorization";

/**
 * Leitura tolerante da preferência.
 *
 * `settings` é `unknown` no contrato — o backend não valida a forma. Qualquer
 * coisa que não seja exatamente `true` é lida como desligado, que é o padrão
 * pedido.
 */
export function readRequiresAuthorization(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const namespace = (settings as Record<string, unknown>)[SETTINGS_NAMESPACE];
  if (!namespace || typeof namespace !== "object") return false;
  return (namespace as Record<string, unknown>)[SETTINGS_KEY] === true;
}

/**
 * Escrita preservando o resto.
 *
 * `PATCH /organizations/current` **substitui** `settings` inteiro — o serviço
 * do backend faz `settings: input.settings`. Enviar só a chave apagaria tudo
 * o que outra tela gravou, branding incluído.
 */
function withAuthorization(
  settings: unknown,
  value: boolean,
): Record<string, unknown> {
  const base =
    settings && typeof settings === "object"
      ? { ...(settings as Record<string, unknown>) }
      : {};
  const namespace =
    base[SETTINGS_NAMESPACE] && typeof base[SETTINGS_NAMESPACE] === "object"
      ? { ...(base[SETTINGS_NAMESPACE] as Record<string, unknown>) }
      : {};

  namespace[SETTINGS_KEY] = value;
  base[SETTINGS_NAMESPACE] = namespace;
  return base;
}

export function OperationAuthorizationSection() {
  const organization = useOrganization();

  if (organization.isPending) return <PanelLoading rows={4} />;
  if (organization.error) {
    return (
      <PanelError
        error={organization.error}
        onRetry={() => void organization.refetch()}
      />
    );
  }
  if (!organization.data) return null;

  return <AuthorizationForm organization={organization.data} />;
}

function AuthorizationForm({ organization }: { organization: Organization }) {
  const session = useSession();
  const update = useUpdateOrganization();

  const enabled = readRequiresAuthorization(organization.settings);
  const canEdit = session.hasPermission("organization.update");

  return (
    <PanelFrame
      panelId="operations-authorization"
      title="Autorização de operações atribuídas"
      description="Exigir aprovação antes de a operação aparecer para o técnico."
    >
      <div className="space-y-5">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {[
            "Operação criada",
            "Atribuição",
            enabled ? "Autorização" : "Autorização (desligada)",
            "Disponível para execução",
          ].map((step, index, steps) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={
                  step.startsWith("Autorização") && enabled
                    ? "rounded-md bg-primary/15 px-2 py-1 text-primary"
                    : "rounded-md bg-surface-strong px-2 py-1"
                }
              >
                {step}
              </span>
              {index < steps.length - 1 ? <span aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Exigir autorização após a atribuição
            </p>
            <p className="text-xs text-muted-foreground">
              Preferência da organização inteira. Não há configuração por
              unidade, por tipo de operação ou por técnico — e o contrato não
              publica nenhuma dessas dimensões.
            </p>
          </div>

          <Switch
            checked={enabled}
            disabled={!canEdit || update.isPending}
            aria-label="Exigir autorização após a atribuição"
            onCheckedChange={(checked) =>
              update.mutate({
                settings: withAuthorization(organization.settings, checked),
              })
            }
          />
        </div>

        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert className="size-4 text-amber-400" aria-hidden />O
            backend ainda não aplica esta regra
          </p>
          <p className="text-xs text-muted-foreground">
            A preferência é gravada em <code>settings</code> e sobrevive ao
            navegador, mas nenhum endpoint a consulta: a operação não tem campo
            de autorização, e <code>GET /operations</code> não filtra por ela.
            Enquanto isso não existir, ligar a chave <strong>não muda</strong> o
            que o técnico enxerga — nem aqui, nem no aplicativo, nem na API.
          </p>
          <p className="text-xs text-muted-foreground">
            Esconder as operações apenas nesta tela daria uma falsa sensação de
            controle: quem executa continuaria vendo tudo pelos outros clientes.
          </p>
        </div>

        {!canEdit ? (
          <p className="text-xs text-muted-foreground">
            Somente quem tem <code>organization.update</code> pode alterar esta
            configuração.
          </p>
        ) : null}

        <MutationError error={update.error} />

        {update.isSuccess ? (
          <p className="text-xs text-emerald-400">Preferência salva.</p>
        ) : null}
      </div>
    </PanelFrame>
  );
}
