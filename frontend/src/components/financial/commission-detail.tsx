"use client";

/**
 * A comissão de um técnico: o que há a receber, o que foi pago, e o histórico.
 *
 * ## Três formas de pagar, um caminho no servidor
 *
 * "Pagar todas do período", "pagar as marcadas" e "pagar esta" são a mesma
 * requisição com seleções diferentes. O servidor recalcula em todos os casos: a
 * tela escolhe **quais** comissões, nunca quanto.
 *
 * ## A lista mistura pendente e paga, de propósito
 *
 * Separar em duas listas obrigaria a comparar as duas para responder "já paguei
 * este atendimento?". Cada linha diz a situação, e a paga mostra o valor que foi
 * pago — não o que a configuração de hoje calcularia.
 *
 * ## O período é escolhido, e vai junto no pagamento
 *
 * O padrão é a janela vigente da política. Trocar o recorte muda a lista **e** o
 * que o botão de pagar todas vai fechar — senão a tela mostraria março e o botão
 * pagaria abril.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCommissionPayments,
  useCommissions,
  usePayCommissions,
} from "@/hooks/commissions/use-commissions";
import { UserReference } from "@/components/identity/user-reference";
import {
  COMMISSION_METHOD_LABELS,
  COMMISSION_PAYMENT_METHODS,
  COMMISSION_PERIOD_LABELS,
  COMMISSION_ROLE_LABELS,
  type Commission,
  type CommissionPaymentMethod,
} from "@/types/commissions";
import { FORMATTERS } from "@/metrics";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { sectionHref } from "@/lib/section-navigation";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/providers/session-provider";

/** A chave de uma comissão na tela: a mesma do servidor. */
const keyOf = (commission: Commission): string =>
  `${commission.operationId}:${commission.role}`;

export function CommissionDetail({ userId }: { userId: string }) {
  const session = useSession();
  const canManage =
    session.hasPermission("financial.manage") &&
    session.hasCapability("financial.manage");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState<CommissionPaymentMethod | "">("");
  const [notes, setNotes] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  /** Recorte só viaja completo: uma data sozinha cairia na janela da política. */
  const recorte = useMemo(() => (from && to ? { from, to } : {}), [from, to]);

  const query = useCommissions({ userId, ...recorte });
  const payments = useCommissionPayments({ userId, limit: 20 });
  const pay = usePayCommissions();

  if (!session.hasPermission("financial.read")) {
    return (
      <ContentContainer size="wide">
        <PanelFrame
          panelId="commission-detail-denied"
          title="Comissão"
          description="Quanto esta pessoa tem a receber"
        >
          <p className="text-sm text-muted-foreground">
            A comissão é informação financeira, e o seu acesso não inclui o
            Financeiro.
          </p>
        </PanelFrame>
      </ContentContainer>
    );
  }

  const commissions = query.data?.commissions ?? [];
  const pendentes = commissions.filter((item) => item.status === "PENDING");
  const totalPendente = pendentes.reduce((soma, item) => soma + item.amount, 0);
  const selecionadas = pendentes.filter((item) => marcadas.has(keyOf(item)));
  const totalSelecionado = selecionadas.reduce(
    (soma, item) => soma + item.amount,
    0,
  );

  const pagar = (selection?: Commission[]) => {
    pay.mutate(
      {
        userId,
        ...(selection
          ? {
              selection: selection.map((item) => ({
                operationId: item.operationId,
                role: item.role,
              })),
            }
          : {}),
        ...recorte,
        ...(method ? { method } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          setMarcadas(new Set());
          setNotes("");
        },
      },
    );
  };

  return (
    <ContentContainer size="wide" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">
            <UserReference userId={userId} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Comissões, pagamentos e histórico.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={sectionHref(ROUTES.team, "tecnicos")}>
            <ArrowLeft className="size-4" />
            Voltar para a equipe
          </Link>
        </Button>
      </div>

      <PanelFrame
        panelId="commission-detail-period"
        title="Período"
        description={
          query.data
            ? `${COMMISSION_PERIOD_LABELS[query.data.window.period]} · ${formatDate(query.data.window.from)} a ${formatDate(query.data.window.to)}`
            : "A janela vigente da política"
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="commission-from">De</Label>
            <Input
              id="commission-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission-to">Até</Label>
            <Input
              id="commission-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          {from || to ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Usar a janela da política
            </Button>
          ) : null}
        </div>
      </PanelFrame>

      <PanelFrame
        panelId="commission-detail-list"
        title="Comissões do período"
        description="Uma linha por atendimento e papel"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">A pagar</span>
            <span className="font-mono font-semibold tabular-nums">
              {FORMATTERS.currency(totalPendente)}
            </span>
          </div>
        }
      >
        {query.isPending ? (
          <PanelLoading rows={4} />
        ) : query.error ? (
          <PanelError
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-4">
            {query.data && !query.data.policy.active ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                A política de comissão está desligada: nada é calculado nem pode
                ser pago. O histórico abaixo continua.
              </p>
            ) : null}

            <MutationError error={pay.error} />

            {commissions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma comissão neste período.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canManage ? <TableHead className="w-10" /> : null}
                        <TableHead>Atendimento</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Concluído</TableHead>
                        <TableHead className="text-right">Base</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead>Situação</TableHead>
                        {canManage ? <TableHead className="w-24" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((item) => {
                        const chave = keyOf(item);
                        const pendente = item.status === "PENDING";
                        return (
                          <TableRow key={chave}>
                            {canManage ? (
                              <TableCell>
                                {pendente ? (
                                  <Checkbox
                                    checked={marcadas.has(chave)}
                                    onCheckedChange={(marcado) =>
                                      setMarcadas((atual) => {
                                        const proximo = new Set(atual);
                                        if (marcado) proximo.add(chave);
                                        else proximo.delete(chave);
                                        return proximo;
                                      })
                                    }
                                    aria-label={`Selecionar ${item.operationCode}`}
                                  />
                                ) : null}
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <p className="font-medium">
                                {item.operationCode}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.customerName ?? item.operationTitle}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {COMMISSION_ROLE_LABELS[item.role]}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.completedAt
                                ? formatDate(item.completedAt)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                              {item.baseAmount === null
                                ? `${item.rate}`
                                : FORMATTERS.currency(item.baseAmount)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {FORMATTERS.currency(item.amount)}
                            </TableCell>
                            <TableCell>
                              {pendente ? (
                                <Badge variant="outline">a pagar</Badge>
                              ) : (
                                <Badge variant="secondary">
                                  pago
                                  {item.paidAt
                                    ? ` em ${formatDate(item.paidAt)}`
                                    : ""}
                                </Badge>
                              )}
                            </TableCell>
                            {canManage ? (
                              <TableCell className="text-right">
                                {pendente ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pay.isPending}
                                    onClick={() => pagar([item])}
                                  >
                                    Pagar
                                  </Button>
                                ) : null}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {canManage && pendentes.length > 0 ? (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="commission-method">Forma</Label>
                        <Select
                          value={method}
                          onValueChange={(value) =>
                            setMethod(value as CommissionPaymentMethod)
                          }
                        >
                          <SelectTrigger id="commission-method">
                            <SelectValue placeholder="Não informar" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMISSION_PAYMENT_METHODS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {COMMISSION_METHOD_LABELS[item]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="commission-notes">Observação</Label>
                        <Input
                          id="commission-notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {selecionadas.length > 0 ? (
                        <Button
                          variant="outline"
                          disabled={pay.isPending}
                          onClick={() => pagar(selecionadas)}
                        >
                          <Wallet className="size-4" />
                          Pagar {selecionadas.length} selecionada
                          {selecionadas.length > 1 ? "s" : ""} ·{" "}
                          {FORMATTERS.currency(totalSelecionado)}
                        </Button>
                      ) : null}
                      <Button disabled={pay.isPending} onClick={() => pagar()}>
                        <Wallet className="size-4" />
                        {pay.isPending
                          ? "Pagando…"
                          : `Pagar todas · ${FORMATTERS.currency(totalPendente)}`}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </PanelFrame>

      <PanelFrame
        panelId="commission-detail-history"
        title="Histórico de pagamentos"
        description="Os últimos vinte, com o que cada um cobriu"
      >
        {payments.isPending ? (
          <PanelLoading rows={3} />
        ) : payments.error ? (
          <PanelError
            error={payments.error}
            onRetry={() => void payments.refetch()}
          />
        ) : (payments.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum pagamento registrado.
          </p>
        ) : (
          <ul className="space-y-3">
            {payments.data?.map((payment) => (
              <li
                key={payment.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold tabular-nums">
                    {FORMATTERS.currency(payment.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(payment.paidAt)}
                    {payment.method
                      ? ` · ${COMMISSION_METHOD_LABELS[payment.method]}`
                      : ""}
                    {payment.createdBy
                      ? ` · por ${payment.createdBy.displayName}`
                      : ""}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {payment.items.length} atendimento
                  {payment.items.length > 1 ? "s" : ""}
                  {payment.periodStart && payment.periodEnd
                    ? ` · ${formatDate(payment.periodStart)} a ${formatDate(payment.periodEnd)}`
                    : ""}
                </p>

                {payment.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {payment.notes}
                  </p>
                ) : null}

                <ul className="mt-2 space-y-1">
                  {payment.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span className="truncate">
                        {item.operationCode ?? item.operationId} ·{" "}
                        {COMMISSION_ROLE_LABELS[item.role]}
                      </span>
                      <span className="font-mono tabular-nums">
                        {FORMATTERS.currency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </PanelFrame>
    </ContentContainer>
  );
}
