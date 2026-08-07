"use client";

/**
 * Papéis e o que cada um concede.
 *
 * ## Somente leitura, e por quê
 *
 * `Role.permissions` é semeado pela plataforma e **nenhuma rota o escreve**.
 * `isSystem` marca os papéis que a organização nem deveria poder editar. O
 * Stage 1 pede explicitamente "não editar papéis caso o backend ainda não
 * suporte" — e ele não suporta.
 *
 * ## Permissões e capabilities são coisas diferentes
 *
 * - **Permissão** vem do **papel**: o que esta pessoa pode fazer.
 * - **Capability** vem do **plano**: o que esta organização contratou.
 *
 * O backend exige as duas (`@Permissions` e `@Capabilities`), e é por isso que
 * um Owner pode não ver um recurso — o papel permite, o plano não inclui. A
 * aba mostra as duas lado a lado justamente para tornar essa distinção
 * visível.
 *
 * ## Módulos
 *
 * O prefixo da permissão (`operations.create` → `operations`) é o mesmo
 * vocabulário que o backend usa para nomear módulos. Agrupar por ele é
 * **apresentação**: nenhuma permissão é inventada, só ordenada.
 */
import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useTeamRoles } from "@/hooks/workforce/use-workforce";
import { useSession } from "@/providers/session-provider";
import { cn } from "@/lib/utils";
import type { TeamRole } from "@/types/workforce";
import { ListState } from "@/workspace";

/** Agrupa permissões pelo prefixo, que é o módulo que o backend nomeia. */
function byModule(
  permissions: readonly string[],
): { module: string; items: readonly string[] }[] {
  const groups = new Map<string, string[]>();
  for (const permission of permissions) {
    /** `module` é palavra reservada no escopo do Next; daí `moduleKey`. */
    const moduleKey = permission.split(".")[0] ?? permission;
    const items = groups.get(moduleKey) ?? [];
    items.push(permission);
    groups.set(moduleKey, items);
  }
  return [...groups.entries()]
    .map(([moduleKey, items]) => ({ module: moduleKey, items: items.sort() }))
    .sort((left, right) => left.module.localeCompare(right.module));
}

export function RolesTab() {
  const query = useTeamRoles();
  const roles = useMemo(() => query.data ?? [], [query.data]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Papéis são somente leitura: as permissões são semeadas pela plataforma e
        não há rota de escrita. O papel de cada pessoa é definido no convite.
      </p>

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={roles}
        empty={{
          icon: <ShieldCheck className="size-5" />,
          title: "Nenhum papel",
          description:
            "A organização ainda não tem papéis próprios cadastrados.",
        }}
      >
        {(rows) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        )}
      </ListState>
    </div>
  );
}

function RoleCard({ role }: { role: TeamRole }) {
  const session = useSession();
  const modules = useMemo(() => byModule(role.permissions), [role.permissions]);

  return (
    <article className="glass-panel space-y-4 rounded-xl p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{role.name}</h3>
          <span className="font-mono text-xs text-muted-foreground">
            {role.key}
          </span>
          {role.isSystem ? <Badge variant="secondary">Sistema</Badge> : null}
          <Badge variant="outline">
            {role.memberCount === 1
              ? "1 pessoa"
              : `${role.memberCount} pessoas`}
          </Badge>
        </div>
        {role.description ? (
          <p className="text-sm text-muted-foreground">{role.description}</p>
        ) : null}
      </header>

      <section className="space-y-2">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Permissões por módulo
        </h4>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma permissão declarada.
          </p>
        ) : (
          <ul className="space-y-2">
            {modules.map((group) => (
              <li key={group.module}>
                <p className="font-mono text-xs text-foreground">
                  {group.module}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {group.items.map((permission) => (
                    <li key={permission}>
                      <span className="rounded-md bg-surface-strong px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {permission.slice(group.module.length + 1) ||
                          permission}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        As capabilities são do **plano**, não do papel — por isso aparecem uma
        vez, iguais para todos os papéis, e a nota explica a diferença. Sem
        isso, "o Owner não vê o módulo X" fica sem explicação.
      */}
      <section className="space-y-2 border-t border-border pt-3">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Capabilities do plano
        </h4>
        <p className="text-xs text-muted-foreground">
          O backend exige permissão <em>e</em> capability. Estas vêm do plano
          contratado e valem para toda a organização, independentemente do
          papel.
        </p>
        <ul className="flex flex-wrap gap-1">
          {session.capabilities.slice(0, 12).map((capability) => (
            <li key={capability}>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[11px]",
                  "bg-primary/10 text-primary",
                )}
              >
                {capability}
              </span>
            </li>
          ))}
          {session.capabilities.length > 12 ? (
            <li className="text-[11px] text-muted-foreground">
              e mais {session.capabilities.length - 12}
            </li>
          ) : null}
        </ul>
      </section>
    </article>
  );
}
