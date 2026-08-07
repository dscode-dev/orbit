"use client";

/**
 * Detalhe de um membro — e a sua carga de trabalho.
 *
 * É também a **visão técnica** que o Stage 1 pede: operações atribuídas,
 * execuções sob responsabilidade e agenda, cada uma vinda do módulo dono com
 * o filtro por pessoa que o contrato já aceita.
 *
 * ## Nada é calculado aqui
 *
 * Os números são `meta.total` do servidor. Não há produtividade: o Analytics
 * publica `technicians.active` e `technicians.assignment_coverage`, que são da
 * **organização**, não de uma pessoa. Derivar "operações por dia" das listas
 * carregadas seria inventar um indicador — e um indicador de desempenho
 * inventado é pior que nenhum, porque alguém decide com ele.
 */
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityBadge, entityHref } from "@/entities";
import {
  useMemberExecutions,
  useMemberOperations,
  useMemberSchedule,
  useTeamRoles,
} from "@/hooks/workforce/use-workforce";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import type { TeamMember } from "@/types/workforce";
import { WorkloadCards } from "./workload-cards";

export function MemberSheet({
  member,
  onOpenChange,
}: {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={member !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {member ? <Body member={member} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Body({ member }: { member: TeamMember }) {
  const roles = useTeamRoles();
  const role = roles.data?.find((item) => item.id === member.role.id);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {member.displayName}
          {member.isOwner ? <Badge variant="secondary">Dono</Badge> : null}
          <EntityBadge
            entity="team-member"
            group="status"
            value={member.status}
          />
        </SheetTitle>
        <SheetDescription>
          {member.email} · na equipe desde {formatDateTime(member.joinedAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-6">
        <WorkloadCards userId={member.userId} />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Papel e permissões efetivas</h3>
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2">
              <Badge variant="outline">{member.role.name}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {member.role.key}
              </span>
            </p>

            {roles.isPending ? (
              <Skeleton className="mt-3 h-16 w-full" />
            ) : role ? (
              <>
                {role.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {role.description}
                  </p>
                ) : null}
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => (
                    <li key={permission}>
                      <span className="rounded-md bg-surface-strong px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {permission}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Estas são as permissões que o backend concede a este papel.
                  Quem autoriza cada requisição continua sendo o servidor.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                O papel não está na lista da organização — pode ser um papel de
                plataforma.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Unidades</h3>
          {member.businessUnits.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {member.businessUnits.map((unit) => (
                <li key={unit.id}>
                  <Badge variant="outline">
                    {unit.tradeName ?? unit.legalName}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem vínculo de unidade — o acesso é em nível de organização.
            </p>
          )}
        </section>

        <RelatedSection userId={member.userId} />
      </div>
    </>
  );
}

/**
 * O que a pessoa tem para fazer.
 *
 * Três listas curtas, cada uma do módulo dono, com "ver todas" levando ao
 * Workspace daquele módulo já filtrado. A navegação usa o Entity Registry —
 * nenhuma rota é montada à mão.
 */
function RelatedSection({ userId }: { userId: string }) {
  const operations = useMemberOperations(userId);
  const executions = useMemberExecutions(userId);
  const schedule = useMemberSchedule(userId);

  return (
    <div className="space-y-4">
      <RelatedList
        icon={<Workflow className="size-4" aria-hidden />}
        title="Operações atribuídas"
        isPending={operations.isPending}
        empty="Nenhuma operação atribuída."
        seeAllHref={`${ROUTES.operations}?assignedUserId=${userId}`}
        rows={(operations.data?.data ?? []).map((operation) => ({
          key: operation.id,
          href: entityHref("operation", operation.id),
          title: operation.title,
          subtitle: operation.code,
          badge: (
            <EntityBadge
              entity="operation"
              group="status"
              value={operation.status}
            />
          ),
        }))}
      />

      <RelatedList
        icon={<ClipboardCheck className="size-4" aria-hidden />}
        title="Execuções em andamento"
        isPending={executions.isPending}
        empty="Nenhuma execução sob responsabilidade."
        seeAllHref={`${ROUTES.executions}?responsibleUserId=${userId}`}
        rows={(executions.data?.data ?? []).map((execution) => ({
          key: execution.id,
          href: entityHref("artifact-execution", execution.id),
          title: execution.title,
          subtitle: `${execution.code} · ${execution.progress}%`,
          badge: null,
        }))}
      />

      <RelatedList
        icon={<CalendarClock className="size-4" aria-hidden />}
        title="Próximos compromissos"
        isPending={schedule.isPending}
        empty="Nada agendado nos próximos 30 dias."
        seeAllHref={ROUTES.scheduling}
        rows={(schedule.data ?? []).slice(0, 5).map((event, index) => ({
          key: `${event.eventId}-${index}`,
          href: null,
          title: event.title,
          subtitle: formatDateTime(event.startsAt),
          badge: null,
        }))}
      />
    </div>
  );
}

interface RelatedRow {
  key: string;
  href: string | null;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
}

function RelatedList({
  icon,
  title,
  isPending,
  empty,
  rows,
  seeAllHref,
}: {
  icon: React.ReactNode;
  title: string;
  isPending: boolean;
  empty: string;
  rows: readonly RelatedRow[];
  seeAllHref: string;
}) {
  return (
    <section className="rounded-xl border border-border">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link href={seeAllHref}>
            Ver todas
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      {isPending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1">
                {row.href ? (
                  <Link href={row.href} className="font-medium hover:underline">
                    {row.title}
                  </Link>
                ) : (
                  <span className="font-medium">{row.title}</span>
                )}
                <span className="block font-mono text-xs text-muted-foreground">
                  {row.subtitle}
                </span>
              </span>
              {row.badge}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
