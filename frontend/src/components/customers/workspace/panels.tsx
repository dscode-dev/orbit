"use client";

/**
 * Painéis do Customer Workspace.
 *
 * Todos recebem o cliente já carregado ou a consulta cruzada pronta — nenhum
 * decide o que é vínculo, o que é indicador ou o que é recomendação.
 */
import { useState } from "react";
import {
  Building2,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Star,
  Trash2,
} from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RelatedRecordsPanel } from "@/entities";
import {
  useCreateContact,
  useCustomerAssets,
  useCustomerExecutions,
  useCustomerIntelligence,
  useCustomerOperations,
  useCustomerSchedule,
  useRemoveContact,
} from "@/hooks/customers/use-customers";
import { formatDateTime } from "@/lib/formatters";
import { formatMetricValue, resolveMetric } from "@/metrics";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_LIMITS,
  type Customer,
  type CustomerContact,
} from "@/types/customers";
import {
  CustomerStatusBadge,
  customerTypeLabel,
  readAddress,
} from "../customer-presentation";

/* ------------------------------------------------------------------ */
/* Geral e endereço                                                    */
/* ------------------------------------------------------------------ */

export function OverviewSection({ customer }: { customer: Customer }) {
  const address = readAddress(customer.address);

  return (
    <PanelFrame
      panelId="customer-overview"
      title="Informações gerais"
      actions={<CustomerStatusBadge status={customer.status} />}
    >
      <div className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Entry label="Razão social">{customer.legalName}</Entry>
          <Entry label="Nome fantasia">{customer.tradeName ?? "—"}</Entry>
          <Entry label="Tipo">{customerTypeLabel(customer.type)}</Entry>
          <Entry label="Documento" mono>
            {customer.documentNumber
              ? `${customer.documentType ?? ""} ${customer.documentNumber}`.trim()
              : "—"}
          </Entry>
          <Entry label="E-mail">{customer.email ?? "—"}</Entry>
          <Entry label="Telefone">{customer.phone ?? "—"}</Entry>
        </dl>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
            <MapPin className="size-3.5" aria-hidden />
            Endereço
          </h3>
          {address.line || address.city ? (
            <p className="text-sm">
              {address.line}
              {address.line && address.city ? " — " : ""}
              {address.city}
              {address.stateCode ? `/${address.stateCode}` : ""}
              {address.known.postalCode ? ` · ${address.known.postalCode}` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem endereço cadastrado.
            </p>
          )}
          {Object.keys(address.extra).length > 0 ? (
            <dl className="grid gap-1 sm:grid-cols-2">
              {Object.entries(address.extra).map(([key, value]) => (
                <div key={key}>
                  <dt className="font-mono text-[10px] text-muted-foreground">
                    {key}
                  </dt>
                  <dd className="text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            `address` é JSON livre — o backend não define esquema, e não há
            coordenadas nem mapa.
          </p>
        </section>

        {customer.notes ? (
          <section className="space-y-1 border-t border-border pt-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              Observações
            </h3>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </section>
        ) : null}
      </div>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Contatos                                                            */
/* ------------------------------------------------------------------ */

/**
 * Contatos.
 *
 * Vêm embutidos no detalhe do cliente, já ordenados pelo backend
 * (`isPrimary desc, name asc`) — não há segunda consulta. As escritas usam o
 * sub-recurso `/customers/:id/contacts` e invalidam o detalhe, que é quem
 * publica a lista.
 */
export function ContactsSection({
  customer,
  canManage,
}: {
  customer: Customer;
  canManage: boolean;
}) {
  const create = useCreateContact(customer.id);
  const remove = useRemoveContact(customer.id);
  const [open, setOpen] = useState(false);

  return (
    <PanelFrame
      panelId="customer-contacts"
      title="Contatos"
      description={`${customer.contacts.length} cadastrado(s)`}
      actions={
        canManage ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Cancelar" : "Novo contato"}
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {open ? (
          <ContactForm
            pending={create.isPending}
            onSubmit={(input) => {
              create.mutate(input, { onSuccess: () => setOpen(false) });
            }}
          />
        ) : null}

        <MutationError error={create.error ?? remove.error} />

        {customer.contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum contato cadastrado para este cliente.
          </p>
        ) : (
          <ul className="space-y-2">
            {customer.contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                canManage={canManage}
                removing={remove.isPending}
                onRemove={() => remove.mutate(contact.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </PanelFrame>
  );
}

function ContactRow({
  contact,
  canManage,
  removing,
  onRemove,
}: {
  contact: CustomerContact;
  canManage: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {contact.name}
          {contact.isPrimary ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Star className="size-2.5" aria-hidden />
              principal
            </Badge>
          ) : null}
          {contact.role ? (
            <span className="text-xs font-normal text-muted-foreground">
              {contact.role}
            </span>
          ) : null}
        </p>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {contact.email ? (
            <span className="flex items-center gap-1">
              <Mail className="size-3" aria-hidden />
              {contact.email}
            </span>
          ) : null}
          {contact.phone ? (
            <span className="flex items-center gap-1">
              <Phone className="size-3" aria-hidden />
              {contact.phone}
            </span>
          ) : null}
        </p>
      </div>

      {canManage ? (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive"
          disabled={removing}
          onClick={onRemove}
          aria-label={`Remover ${contact.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </li>
  );
}

function ContactForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Nome</Label>
        <Input
          id="contact-name"
          value={name}
          maxLength={CUSTOMER_LIMITS.contactNameMaxLength}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-role">Função</Label>
        <Input
          id="contact-role"
          value={role}
          maxLength={CUSTOMER_LIMITS.contactRoleMaxLength}
          onChange={(event) => setRole(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">E-mail</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-phone">Telefone</Label>
        <Input
          id="contact-phone"
          value={phone}
          maxLength={CUSTOMER_LIMITS.phoneMaxLength}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <Button
        className="sm:col-span-2"
        disabled={name.trim().length < 2 || pending}
        onClick={() =>
          onSubmit({
            name: name.trim(),
            role: role.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          })
        }
      >
        {pending ? "Salvando…" : "Adicionar contato"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vínculos                                                            */
/* ------------------------------------------------------------------ */

export function CustomerAssetsSection({ customerId }: { customerId: string }) {
  const query = useCustomerAssets(customerId);

  return (
    <RelatedRecordsPanel
      entity="asset"
      panelId="customer-assets"
      title="Ativos"
      description="Equipamentos deste cliente"
      query={query}
      emptyMessage="Nenhum ativo vinculado a este cliente."
      seeAllHref={ROUTES.assets}
      toRows={(page) =>
        page.data.map((asset) => ({
          key: asset.id,
          entityId: asset.id,
          title: asset.name,
          subtitle: [asset.manufacturer, asset.model, asset.location]
            .filter(Boolean)
            .join(" · "),
          status: asset.status,
        }))
      }
    />
  );
}

export function CustomerOperationsSection({
  customerId,
}: {
  customerId: string;
}) {
  const query = useCustomerOperations(customerId);

  return (
    <RelatedRecordsPanel
      entity="operation"
      panelId="customer-operations"
      title="Operações"
      description="Ordens de serviço deste cliente"
      query={query}
      emptyMessage="Nenhuma operação registrada para este cliente."
      seeAllHref={ROUTES.operations}
      toRows={(page) =>
        page.data.map((operation) => ({
          key: operation.id,
          entityId: operation.id,
          title: operation.title,
          subtitle: `${operation.code}${
            operation.scheduledStart
              ? ` · ${formatDateTime(operation.scheduledStart)}`
              : ""
          }`,
          status: operation.status,
        }))
      }
    />
  );
}

export function CustomerScheduleSection({
  customerId,
}: {
  customerId: string;
}) {
  const query = useCustomerSchedule(customerId);

  return (
    <RelatedRecordsPanel
      entity="scheduling-event"
      panelId="customer-schedule"
      title="Agenda futura"
      description="Próximos 90 dias, com recorrências expandidas pelo backend"
      query={query}
      emptyMessage="Nada agendado para este cliente nos próximos 90 dias."
      seeAllHref={ROUTES.scheduling}
      toRows={(occurrences) =>
        occurrences.slice(0, 5).map((occurrence) => ({
          key: occurrence.occurrenceId,
          entityId: occurrence.eventId,
          title: occurrence.title,
          subtitle: `${formatDateTime(occurrence.startsAt)} · ${occurrence.type}`,
          status: occurrence.status,
        }))
      }
    />
  );
}

export function CustomerExecutionsSection({
  customerId,
}: {
  customerId: string;
}) {
  const query = useCustomerExecutions(customerId);

  return (
    <RelatedRecordsPanel
      entity="artifact-execution"
      panelId="customer-executions"
      title="Artefatos executados"
      description="PMOCs, relatórios e checklists deste cliente"
      query={query}
      emptyMessage="Nenhum artefato executado para este cliente."
      seeAllHref={ROUTES.executions}
      toRows={(page) =>
        page.data.map((execution) => ({
          key: execution.id,
          entityId: execution.id,
          title: execution.title,
          subtitle: `${execution.code} · ${execution.progress}% concluído`,
          status: execution.status,
        }))
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

/**
 * Indicadores do cliente.
 *
 * **Os dois primeiros vêm prontos do backend.** O `include` do repositório
 * traz `_count: { assets, operations }`, contado no banco e já excluindo
 * registros removidos. Não há soma no cliente.
 *
 * A apresentação — rótulo, ícone, cor, formato, descrição — passa pelo Metric
 * Registry, com definições registradas para os ids abaixo.
 *
 * O que **não** está aqui: receita, ticket médio, tempo de resposta e
 * inadimplência. São indicadores legítimos de gestão de carteira e nenhum tem
 * fonte — o Analytics é escopado por unidade e período, não por cliente.
 */
export function IndicatorsSection({ customer }: { customer: Customer }) {
  return (
    <PanelFrame
      panelId="customer-indicators"
      title="Indicadores"
      description="Contagens publicadas pelo backend"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Counter
          metricId="customer.assets.total"
          value={customer._count.assets}
        />
        <Counter
          metricId="customer.operations.total"
          value={customer._count.operations}
        />
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Receita, ticket médio e tempo de resposta dependem de Read Models por
        cliente que o Analytics não publica — ele é escopado por unidade e
        período.
      </p>
    </PanelFrame>
  );
}

function Counter({
  metricId,
  value,
}: {
  metricId: string;
  value: number | undefined;
}) {
  const definition = resolveMetric({ id: metricId });
  const Icon = definition.icon;

  return (
    <div className="space-y-1 rounded-lg border border-border px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5", definition.color)} aria-hidden />
        {definition.label}
      </p>
      {value === undefined ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="font-display text-2xl font-bold tabular-nums">
          {formatMetricValue(definition, value)}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        {definition.description}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orbit Intelligence                                                  */
/* ------------------------------------------------------------------ */

/**
 * Orbit Intelligence do cliente.
 *
 * **Este é o primeiro Workspace de entidade com fonte de IA de verdade.**
 * `AiExecutionQueryDto` aceita `customerId`, então as execuções listadas são as
 * que o backend associou a este cliente — diferente do Asset Workspace, onde
 * nenhum endpoint tem escopo de equipamento.
 *
 * `output` é JSON livre, definido pelo agente que executou. O painel lê as
 * chaves usuais quando existem e declara "formato não reconhecido" quando não
 * encontra nenhuma — assumir estrutura quebraria no primeiro agente diferente.
 *
 * **Nada é gerado aqui.**
 */
export function IntelligenceSection({
  customerId,
  enabled,
}: {
  customerId: string;
  enabled: boolean;
}) {
  const query = useCustomerIntelligence(customerId, enabled);

  if (!enabled) {
    return (
      <PanelFrame
        panelId="customer-intelligence"
        title="Orbit Intelligence"
        description="Análises associadas a este cliente"
      >
        <p className="py-6 text-center text-sm text-muted-foreground">
          O plano desta organização não inclui a leitura de execuções de IA.
        </p>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame
      panelId="customer-intelligence"
      title="Orbit Intelligence"
      description="Execuções de IA associadas a este cliente"
    >
      <PanelState
        query={toPanelQuery(query)}
        loadingRows={3}
        isEmpty={(page) => page.data.length === 0}
        emptyMessage="Nenhuma análise registrada para este cliente."
      >
        {(page) => (
          <ul className="space-y-2">
            {page.data.map((execution) => (
              <li
                key={execution.id}
                className="space-y-1 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Lightbulb
                    className="size-4 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <span className="text-sm font-medium">
                    {execution.purpose}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {execution.status}
                  </Badge>
                </div>
                <IntelligenceOutput output={execution.output} />
                <p className="text-[10px] text-muted-foreground">
                  {formatDateTime(execution.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PanelState>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        O conteúdo de <code>output</code> é definido pelo agente que executou; o
        backend não publica esquema. Nada é gerado no navegador.
      </p>
    </PanelFrame>
  );
}

/** Chaves usuais em `output`. Ausentes todas, o formato é declarado desconhecido. */
const OUTPUT_KEYS = [
  ["summary", "Resumo"],
  ["alerts", "Alertas"],
  ["recommendations", "Recomendações"],
  ["opportunities", "Oportunidades"],
  ["observations", "Observações"],
  ["insights", "Observações"],
] as const;

function IntelligenceOutput({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") {
    return (
      <p className="text-xs text-muted-foreground">
        Sem saída registrada para esta execução.
      </p>
    );
  }

  const record = output as Record<string, unknown>;
  const blocks = OUTPUT_KEYS.filter(([key]) => record[key] !== undefined);

  if (blocks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Saída em formato não reconhecido por esta versão da interface.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {blocks.map(([key, label]) => {
        const value = record[key];
        return (
          <div key={key} className="text-xs">
            <span className="text-muted-foreground">{label}: </span>
            {Array.isArray(value) ? (
              <span>{value.map((item) => String(item)).join(" · ")}</span>
            ) : (
              <span>{String(value)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

/**
 * Histórico do cliente.
 *
 * O modelo `Customer` não tem tabela de eventos, e não há endpoint de
 * auditoria. Os painéis de operações, agenda e artefatos mostram os registros
 * vinculados; uma linha do tempo do relacionamento depende de o backend
 * publicá-la.
 */
export function HistorySection() {
  return (
    <PanelFrame
      panelId="customer-history"
      title="Histórico"
      description="Eventos do relacionamento ao longo do tempo"
    >
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
        <Building2 className="size-5 text-muted-foreground" aria-hidden />
        <p className="max-w-md text-sm text-muted-foreground">
          Não há tabela de histórico do cliente nem endpoint de auditoria. O que
          existe de datado são os registros vinculados, nos painéis acima.
        </p>
      </div>
    </PanelFrame>
  );
}

function Entry({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm"}>
        {children}
      </dd>
    </div>
  );
}
