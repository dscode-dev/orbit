"use client";

/**
 * Contexto ativo — organização, unidade, papéis, permissões e capabilities.
 *
 * Tudo vem da **sessão da aplicação** (`GET /session`), que o BFF monta a
 * partir das claims do token. Nada é consultado de novo: é exatamente o que o
 * backend usa para autorizar cada requisição, exibido.
 *
 * ## Trocar de organização não é oferecido
 *
 * O backend deriva **uma** organização das claims do token, e não há rota que
 * aceite outra por requisição. `canSwitchOrganization` responde isso, e a tela
 * declara em vez de mostrar um seletor que não funcionaria.
 *
 * Trocar de **unidade** é diferente: é escolha do cliente
 * (`RequestContextProvider`), viaja como parâmetro nas consultas, e por isso é
 * oferecida.
 */
import { Building2, Check, Layers, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useActiveScope } from "@/providers/use-active-scope";
import { useSession } from "@/providers/session-provider";

/** "Toda a organização" precisa de um valor real no `Select`. */
const ALL_UNITS = "__all__";

export function ContextTab() {
  const session = useSession();
  const scope = useActiveScope();

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-panel space-y-4 rounded-xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="size-4 text-muted-foreground" aria-hidden />
          Organização
        </h3>

        <dl className="grid gap-4 sm:grid-cols-2">
          <Entry label="Nome">
            {session.organization?.displayName ?? "—"}
          </Entry>
          <Entry label="Plano">
            {session.entitlements ? (
              <Badge variant="outline">{session.entitlements.planKey}</Badge>
            ) : (
              "—"
            )}
          </Entry>
          <Entry label="Assinatura">
            <Badge
              variant={session.subscriptionActive ? "secondary" : "outline"}
            >
              {session.subscriptionActive ? "ativa" : "inativa"}
            </Badge>
          </Entry>
          <Entry label="Segmento">
            {session.organization?.primarySegment ?? "—"}
          </Entry>
        </dl>

        {!scope.canSwitchOrganization ? (
          <p className="text-xs text-muted-foreground">
            O backend deriva uma organização das claims do token e não aceita
            outra por requisição — por isso a troca não é oferecida.
          </p>
        ) : null}
      </section>

      <section className="glass-panel space-y-4 rounded-xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Layers className="size-4 text-muted-foreground" aria-hidden />
          Unidade ativa
        </h3>

        {scope.canSwitchBusinessUnit ? (
          <div className="max-w-sm space-y-2">
            <Label htmlFor="context-unit">Unidade</Label>
            <Select
              value={scope.businessUnitId ?? ALL_UNITS}
              onValueChange={(value) =>
                scope.switchBusinessUnit(value === ALL_UNITS ? null : value)
              }
            >
              <SelectTrigger id="context-unit">
                <SelectValue placeholder="Toda a organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Toda a organização</SelectItem>
                {scope.businessUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.tradeName ?? unit.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Trocar a unidade descarta os dados carregados do escopo anterior —
              nenhuma consulta de um escopo aparece em outro.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {scope.businessUnit
              ? (scope.businessUnit.tradeName ?? scope.businessUnit.legalName)
              : "Acesso em nível de organização."}
          </p>
        )}
      </section>

      <section className="glass-panel space-y-4 rounded-xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
          Papéis e permissões efetivas
        </h3>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Papéis</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {session.roles.length > 0 ? (
                session.roles.map((role) => (
                  <li key={role}>
                    <Badge variant="outline">{role}</Badge>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">Nenhum</li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Permissões ({session.permissions.length})
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {session.permissions.map((permission) => (
                <li key={permission}>
                  <span className="rounded-md bg-surface-strong px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {permission}
                  </span>
                </li>
              ))}
            </ul>
            {session.permissions.includes("*") ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono">*</span> concede tudo — é o papel de
                dono da organização.
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Capabilities do plano ({session.capabilities.length})
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {session.capabilities.map((capability) => (
                <li key={capability}>
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    <Check className="size-2.5" />
                    {capability}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          O backend exige permissão <em>e</em> capability: a primeira vem do
          papel, a segunda do plano. É por isso que um recurso pode faltar mesmo
          para quem tem todas as permissões.
        </p>
      </section>
    </div>
  );
}

function Entry({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
