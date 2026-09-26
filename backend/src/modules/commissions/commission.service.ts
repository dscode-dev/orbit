/**
 * Comissão de técnicos.
 *
 * ## A pendente é derivada; a paga é gravada
 *
 * Não há tabela de comissões a pagar: a lista é calculada a cada leitura, a
 * partir de atendimento concluído, técnico responsável, auxiliares ativos e
 * receita confirmada, cruzados com a política vigente. O que se grava é o
 * pagamento — e nele o valor congela.
 *
 * A consequência é deliberada: mudar a política muda o que está **pendente**, e
 * não mexe em nada do que já foi pago. É o comportamento que se espera de um
 * acordo novo com a equipe, e é o oposto do que aconteceria se as comissões
 * fossem materializadas na conclusão do atendimento.
 *
 * ## O valor nunca vem do cliente
 *
 * `pay` recalcula tudo antes de gravar e ignora qualquer número que tenha
 * chegado — a requisição escolhe **quais** comissões pagar, nunca quanto.
 */
import { Injectable } from '@nestjs/common';
import { ConflictException, ValidationException } from '../../exceptions';
import {
  currentWindow,
  linesFor,
  sumAmounts,
  type CommissionLine,
  type CommissionMode,
  type CommissionPeriod,
  type CommissionPolicySource,
  type CommissionRole,
} from './commission.calculator';
import {
  CommissionRepository,
  type CommissionWorkload,
} from './commission.repository';
import type {
  CommissionOverviewReadModel,
  CommissionPaymentReadModel,
  CommissionPolicyReadModel,
  CommissionReadModel,
  CommissionSummaryReadModel,
} from './commission.read-models';
import type {
  CommissionQueryDto,
  CommissionPaymentQueryDto,
  PayCommissionsDto,
  SaveCommissionPolicyDto,
} from './commission.dto';

export interface CommissionActor {
  organizationId: string;
  actorId: string;
}

/**
 * A política de quem nunca configurou.
 *
 * Desligada e sem valor, de propósito: o padrão não pode ser pagar comissão que
 * ninguém combinou. A tela lê `configured: false` e pede a primeira configuração.
 */
const PADRAO: CommissionPolicyReadModel = {
  configured: false,
  active: false,
  period: 'MONTHLY',
  mode: 'FIXED',
  primaryValue: 0,
  assistantValue: 0,
  eligibleKinds: [],
  requiresConfirmedRevenue: true,
  updatedAt: null,
};

/** Chave de uma comissão: atendimento + pessoa + papel. */
function keyOf(input: {
  operationId: string;
  userId: string;
  role: string;
}): string {
  return `${input.operationId}:${input.userId}:${input.role}`;
}

@Injectable()
export class CommissionService {
  constructor(private readonly repository: CommissionRepository) {}

  async policy(actor: CommissionActor): Promise<CommissionPolicyReadModel> {
    const row = await this.repository.findPolicy(actor.organizationId);
    if (!row) return PADRAO;

    return {
      configured: true,
      active: row.active,
      period: row.period as CommissionPeriod,
      mode: row.mode as CommissionMode,
      primaryValue: Number(row.primaryValue),
      assistantValue: Number(row.assistantValue),
      eligibleKinds: row.eligibleKinds,
      requiresConfirmedRevenue: row.requiresConfirmedRevenue,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async savePolicy(
    actor: CommissionActor,
    input: SaveCommissionPolicyDto,
  ): Promise<CommissionPolicyReadModel> {
    /* Percentual acima de 100 entregaria mais que a receita do atendimento. O
       `CHECK` do banco também recusa; aqui a recusa tem mensagem. */
    if (input.mode === 'PERCENTAGE') {
      if (input.primaryValue > 100 || input.assistantValue > 100) {
        throw new ValidationException(
          'Percentual de comissão não pode passar de 100%',
        );
      }
    }
    if (input.active && input.primaryValue <= 0 && input.assistantValue <= 0) {
      throw new ValidationException(
        'Uma política ativa precisa de valor para pelo menos um papel',
      );
    }

    await this.repository.upsertPolicy(actor.organizationId, actor.actorId, {
      period: input.period,
      mode: input.mode,
      primaryValue: input.primaryValue,
      assistantValue: input.assistantValue,
      eligibleKinds: input.eligibleKinds ?? [],
      requiresConfirmedRevenue: input.requiresConfirmedRevenue,
      active: input.active,
    });

    return this.policy(actor);
  }

  /**
   * As comissões da janela, pendentes e pagas.
   *
   * Uma linha por atendimento/pessoa/papel. O que já foi pago vem marcado com o
   * pagamento que o cobriu — a lista serve tanto para pagar quanto para conferir
   * o que foi pago, e separar as duas em telas diferentes obrigaria a pessoa a
   * comparar duas listas para responder "já paguei isso?".
   */
  async list(
    actor: CommissionActor,
    query: CommissionQueryDto,
  ): Promise<{
    window: { from: string; to: string; period: CommissionPeriod };
    policy: CommissionPolicyReadModel;
    commissions: CommissionReadModel[];
  }> {
    const policy = await this.policy(actor);
    const window = this.windowFor(policy.period, query);

    if (!policy.active) {
      return {
        window: { ...this.serializeWindow(window), period: policy.period },
        policy,
        commissions: [],
      };
    }

    const { lines, paid, names } = await this.compute(actor, policy, {
      from: window.from,
      to: window.to,
      userId: query.userId,
      businessUnitId: query.businessUnitId,
    });

    const commissions = lines.map<CommissionReadModel>((line) => {
      const pago = paid.get(keyOf(line));
      return {
        operationId: line.operationId,
        operationCode: line.operationCode,
        operationTitle: line.operationTitle,
        customerName: line.customerName,
        completedAt: line.completedAt?.toISOString() ?? null,
        userId: line.userId,
        userName: names.get(line.userId) ?? null,
        role: line.role,
        mode: line.mode,
        rate: line.rate,
        baseAmount: line.baseAmount,
        /* Pago, o valor é o que foi pago — e não o que a política de hoje
           calcularia. Mostrar o recalculado faria o histórico mudar sozinho. */
        amount: pago ? pago.amount : line.amount,
        status: pago ? 'PAID' : 'PENDING',
        paidAt: pago?.paidAt ?? null,
        paymentId: pago?.paymentId ?? null,
      };
    });

    return {
      window: { ...this.serializeWindow(window), period: policy.period },
      policy,
      commissions,
    };
  }

  /**
   * Uma linha por técnico: o que há a pagar, o que já foi pago e a carga.
   *
   * É o que a tabela da Equipe mostra. Os quatro números de carga vêm em
   * agrupamentos do servidor — a tela os buscava com uma consulta por número por
   * pessoa, o que dava oitenta requisições numa equipe de vinte.
   */
  async overview(
    actor: CommissionActor,
    query: CommissionQueryDto,
  ): Promise<CommissionOverviewReadModel> {
    const policy = await this.policy(actor);
    const window = this.windowFor(policy.period, query);

    const inactiveReason = !policy.configured
      ? 'A comissão ainda não foi configurada.'
      : !policy.active
        ? 'A política de comissão está desligada.'
        : null;

    const { lines, paid, members, workload } = await this.compute(
      actor,
      policy,
      {
        from: window.from,
        to: window.to,
        userId: query.userId,
        businessUnitId: query.businessUnitId,
        /* A tabela lista a equipe inteira, inclusive quem não tem comissão na
           janela: uma tabela que esconde o técnico sem comissão faria a pessoa
           procurar por alguém que "desapareceu". */
        includeAllTechnicians: true,
      },
    );

    const porTecnico = new Map<string, CommissionSummaryReadModel>();
    const linhaDe = (userId: string): CommissionSummaryReadModel => {
      const existente = porTecnico.get(userId);
      if (existente) return existente;
      const membro = members.get(userId);
      const carga: CommissionWorkload = workload.get(userId) ?? {
        assignedOperations: 0,
        operationsInProgress: 0,
        executionsResponsible: 0,
        executionsInProgress: 0,
      };
      const nova: CommissionSummaryReadModel = {
        userId,
        userName: membro?.displayName ?? null,
        email: membro?.email ?? null,
        roleName: membro?.roleName ?? null,
        membershipStatus: membro?.status ?? null,
        pendingAmount: 0,
        pendingCount: 0,
        paidAmount: 0,
        paidCount: 0,
        ...carga,
      };
      porTecnico.set(userId, nova);
      return nova;
    };

    for (const userId of members.keys()) linhaDe(userId);

    for (const line of lines) {
      const linha = linhaDe(line.userId) as {
        -readonly [
          K in keyof CommissionSummaryReadModel
        ]: CommissionSummaryReadModel[K];
      };
      const pago = paid.get(keyOf(line));
      if (pago) {
        linha.paidAmount = Number((linha.paidAmount + pago.amount).toFixed(2));
        linha.paidCount += 1;
      } else {
        linha.pendingAmount = Number(
          (linha.pendingAmount + line.amount).toFixed(2),
        );
        linha.pendingCount += 1;
      }
    }

    const technicians = [...porTecnico.values()].sort((a, b) => {
      /* Quem tem comissão a pagar primeiro: é o que a tela existe para
         resolver. Depois, ordem alfabética. */
      if (b.pendingAmount !== a.pendingAmount) {
        return b.pendingAmount - a.pendingAmount;
      }
      return (a.userName ?? '').localeCompare(b.userName ?? '', 'pt-BR');
    });

    return {
      window: { ...this.serializeWindow(window), period: policy.period },
      policy,
      inactiveReason,
      technicians,
      pendingTotal: sumAmounts(
        technicians.map((linha) => ({ amount: linha.pendingAmount })),
      ),
      paidTotal: sumAmounts(
        technicians.map((linha) => ({ amount: linha.paidAmount })),
      ),
    };
  }

  async payments(
    actor: CommissionActor,
    query: CommissionPaymentQueryDto,
  ): Promise<CommissionPaymentReadModel[]> {
    const rows = await this.repository.listPayments({
      organizationId: actor.organizationId,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amount: Number(row.amount),
      currency: row.currency,
      method: row.method,
      notes: row.notes,
      periodStart: row.periodStart?.toISOString() ?? null,
      periodEnd: row.periodEnd?.toISOString() ?? null,
      paidAt: row.paidAt.toISOString(),
      createdBy: row.createdBy,
      items: row.items.map((item) => ({
        id: item.id,
        operationId: item.operationId,
        operationCode: item.operation?.code ?? null,
        operationTitle: item.operation?.title ?? null,
        role: item.role as CommissionRole,
        mode: item.mode as CommissionMode,
        rate: Number(item.rate),
        baseAmount: item.baseAmount === null ? null : Number(item.baseAmount),
        amount: Number(item.amount),
      })),
    }));
  }

  /**
   * Paga comissões.
   *
   * Sem `selection`, paga todas as pendentes da janela — o fechamento. Com
   * `selection`, paga só as escolhidas, o que cobre "pagar uma" e "pagar as
   * marcadas" com o mesmo caminho.
   *
   * O que já foi pago é descartado em silêncio: entre abrir a tela e clicar,
   * alguém pode ter fechado a mesma comissão, e recusar o lote inteiro por causa
   * de uma linha obrigaria a recarregar e tentar de novo. O índice único do banco
   * continua sendo a garantia final.
   */
  async pay(
    actor: CommissionActor,
    input: PayCommissionsDto,
  ): Promise<CommissionPaymentReadModel> {
    const policy = await this.policy(actor);
    if (!policy.active) {
      throw new ConflictException(
        'A política de comissão está desligada; nada pode ser pago',
      );
    }

    const window = this.windowFor(policy.period, input);

    const { lines, paid } = await this.compute(actor, policy, {
      from: window.from,
      to: window.to,
      userId: input.userId,
    });

    const escolhidas = input.selection
      ? new Set(
          input.selection.map((item) =>
            keyOf({
              operationId: item.operationId,
              userId: input.userId,
              role: item.role,
            }),
          ),
        )
      : null;

    /* As linhas já vêm da pessoa: `compute` recebeu `userId` e o recorte é do
       banco. Filtrar por pessoa outra vez aqui seria uma segunda régua para a
       mesma regra — e a que não tem teste é a que fica errada. */
    const pagar = lines.filter((line) => {
      if (paid.has(keyOf(line))) return false;
      return escolhidas ? escolhidas.has(keyOf(line)) : true;
    });

    if (pagar.length === 0) {
      throw new ConflictException(
        'Nenhuma comissão pendente para pagar neste recorte',
      );
    }

    const payment = await this.repository.createPayment({
      organizationId: actor.organizationId,
      userId: input.userId,
      actorId: actor.actorId,
      amount: sumAmounts(pagar),
      method: input.method,
      notes: input.notes,
      periodStart: window.from,
      periodEnd: window.to,
      lines: pagar,
    });

    /* Relê pelo mesmo caminho da listagem: um pagamento devolvido com forma
       diferente da que a tela já sabe ler seria duas apresentações do mesmo
       dado. O `payment` cru entra só se a releitura não achar nada. */
    const [lido] = await this.payments(actor, {
      userId: input.userId,
      limit: 1,
    });

    return lido ?? this.mapPayment(payment);
  }

  /* ---------------------------------------------------------------- */
  /* Interno                                                           */
  /* ---------------------------------------------------------------- */

  /** A janela pedida, ou a vigente da política. */
  private windowFor(
    period: CommissionPeriod,
    query: { from?: string; to?: string },
  ): { from: Date; to: Date } {
    if (query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (to < from) {
        throw new ValidationException('O fim do recorte é antes do início');
      }
      return { from, to };
    }
    return currentWindow(period);
  }

  private serializeWindow(window: { from: Date; to: Date }) {
    return { from: window.from.toISOString(), to: window.to.toISOString() };
  }

  /**
   * As linhas da janela, o que já foi pago e quem são as pessoas.
   *
   * Um lugar só: a listagem, o resumo e o pagamento têm de concordar sobre
   * quanto é a comissão de cada um. Três cálculos separados divergiriam, e a
   * divergência apareceria como um valor na tela diferente do valor pago.
   */
  private async compute(
    actor: CommissionActor,
    policy: CommissionPolicyReadModel,
    options: {
      from: Date;
      to: Date;
      userId?: string;
      businessUnitId?: string;
      includeAllTechnicians?: boolean;
    },
  ) {
    const source: CommissionPolicySource = {
      period: policy.period,
      mode: policy.mode,
      primaryValue: policy.primaryValue,
      assistantValue: policy.assistantValue,
      eligibleKinds: policy.eligibleKinds,
      requiresConfirmedRevenue: policy.requiresConfirmedRevenue,
      active: policy.active,
    };

    const operations = policy.active
      ? await this.repository.findCompletedOperations({
          organizationId: actor.organizationId,
          from: options.from,
          to: options.to,
          businessUnitId: options.businessUnitId,
          userId: options.userId,
        })
      : [];

    const lines: CommissionLine[] = [];
    for (const operation of operations) {
      const receita = operation.financialEntries.reduce(
        (total, entry) => total + Number(entry.amount),
        0,
      );
      lines.push(
        ...linesFor(
          {
            id: operation.id,
            code: operation.code,
            title: operation.title,
            kind: operation.kind,
            status: operation.status,
            completedAt: operation.completedAt,
            customerName:
              operation.customer?.tradeName ??
              operation.customer?.legalName ??
              null,
            primaryUserId: operation.responsibleFieldTechnicianId,
            assistantUserIds: operation.auxiliaryTechnicians.map(
              (auxiliar) => auxiliar.userId,
            ),
            confirmedRevenue: receita,
          },
          source,
        ),
      );
    }

    /* Recorte por pessoa: o atendimento vem inteiro do banco — com o
       responsável e os auxiliares —, e sem este filtro a comissão dos colegas
       apareceria na consulta de uma pessoa só. */
    const doFiltro = options.userId
      ? lines.filter((line) => line.userId === options.userId)
      : lines;

    const pagos = await this.repository.findPaidItems({
      organizationId: actor.organizationId,
      operationIds: [...new Set(doFiltro.map((line) => line.operationId))],
    });

    const paid = new Map(
      pagos.map((item) => [
        keyOf(item),
        {
          amount: Number(item.amount),
          paymentId: item.paymentId,
          paidAt: item.payment?.paidAt.toISOString() ?? null,
        },
      ]),
    );

    const userIds = new Set(doFiltro.map((line) => line.userId));
    if (options.includeAllTechnicians) {
      for (const id of await this.repository.findFieldTechnicianIds(
        actor.organizationId,
        options.userId,
      )) {
        userIds.add(id);
      }
    }

    const membros = await this.repository.findTechnicians(
      actor.organizationId,
      [...userIds],
    );

    const members = new Map(
      membros.map((membro) => [
        membro.userId,
        {
          displayName: membro.user.displayName,
          email: membro.user.email,
          roleName: membro.role?.name ?? null,
          status: membro.status,
        },
      ]),
    );

    const names = new Map(
      [...members.entries()].map(([userId, membro]) => [
        userId,
        membro.displayName,
      ]),
    );

    const workload = options.includeAllTechnicians
      ? await this.repository.findWorkload(actor.organizationId, [
          ...members.keys(),
        ])
      : new Map<string, CommissionWorkload>();

    return { lines: doFiltro, paid, members, names, workload };
  }

  private mapPayment(payment: {
    id: string;
    userId: string;
    amount: unknown;
    currency: string;
    method: string | null;
    notes: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    paidAt: Date;
    createdBy: { id: string; displayName: string } | null;
    items: readonly {
      id: string;
      operationId: string;
      role: string;
      mode: string;
      rate: unknown;
      baseAmount: unknown;
      amount: unknown;
      operation?: { code: string; title: string } | null;
    }[];
  }): CommissionPaymentReadModel {
    return {
      id: payment.id,
      userId: payment.userId,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      notes: payment.notes,
      periodStart: payment.periodStart?.toISOString() ?? null,
      periodEnd: payment.periodEnd?.toISOString() ?? null,
      paidAt: payment.paidAt.toISOString(),
      createdBy: payment.createdBy,
      items: payment.items.map((item) => ({
        id: item.id,
        operationId: item.operationId,
        operationCode: item.operation?.code ?? null,
        operationTitle: item.operation?.title ?? null,
        role: item.role as CommissionRole,
        mode: item.mode as CommissionMode,
        rate: Number(item.rate),
        baseAmount: item.baseAmount === null ? null : Number(item.baseAmount),
        amount: Number(item.amount),
      })),
    };
  }
}
