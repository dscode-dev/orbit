/**
 * Do estado do provedor para o comando do Orbit.
 *
 * ## O evento é um aviso, não um fato
 *
 * Um evento diz "olha aqui". O que vale é o objeto **canônico** buscado no
 * provedor no momento de reconciliar. Isso resolve de uma vez três problemas
 * que costumam virar bugs caros:
 *
 * - **ordem.** Eventos chegam fora de ordem, e dois podem nascer no mesmo
 *   segundo — ordenar por `event.created` não decide nada. Buscando o objeto
 *   atual, um `payment_failed` antigo que chega depois de um pagamento não
 *   suspende ninguém: o provedor diz que está pago, e é isso que se aplica;
 * - **duplicidade.** Reprocessar o mesmo evento aplica o mesmo estado atual, e
 *   aplicar duas vezes o mesmo estado não muda nada;
 * - **perda.** Se um evento nunca chegou, a varredura periódica pergunta ao
 *   provedor e converge do mesmo jeito.
 *
 * ## Indisponibilidade não é inadimplência
 *
 * Se o provedor não responde, nada acontece: o evento fica pendente e é
 * tentado de novo. Tratar tempo esgotado como cobrança falhada suspenderia
 * clientes em dia num dia ruim do fornecedor.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext, RequestContextStorage } from '../../context';
import { SubscriptionService } from '../subscription-plans/subscriptions/subscription.service';
import {
  SubscriptionStatus,
  grantsProductAccess,
} from '../subscription-plans/subscriptions/subscription.types';
import { BillingProviderUnavailableException } from './billing.errors';
import { BillingRepository } from './billing.repository';
import {
  BILLING_PROVIDER,
  ProviderBillingState,
  type BillingProvider,
  type ProviderSubscription,
} from './billing.types';

/** Eventos que este código sabe transformar em comando. O resto é ignorado. */
const EVENTOS_TRATADOS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

const LOTE = 50;

export interface BillingReconciliationSummary {
  readonly examined: number;
  readonly processed: number;
  readonly ignored: number;
  readonly failed: number;
  readonly deferred: number;
}

@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly repository: BillingRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly contexts: RequestContextStorage,
  ) {}

  /** Processa a caixa de entrada. Repetir não muda o resultado. */
  async drainInbox(): Promise<BillingReconciliationSummary> {
    const resumo = {
      examined: 0,
      processed: 0,
      ignored: 0,
      failed: 0,
      deferred: 0,
    };
    if (!this.provider.isEnabled()) return resumo;

    const pendentes = await this.repository.pendingEvents(LOTE);
    for (const evento of pendentes) {
      resumo.examined += 1;

      if (!EVENTOS_TRATADOS.has(evento.eventType)) {
        /** Assinado mas sem consumidor: reconhecido e arquivado, sem falhar. */
        await this.repository.finishEvent(evento.id, 'IGNORED');
        resumo.ignored += 1;
        continue;
      }
      if (!evento.providerSubscriptionId) {
        await this.repository.finishEvent(
          evento.id,
          'IGNORED',
          'NO_SUBSCRIPTION',
        );
        resumo.ignored += 1;
        continue;
      }

      try {
        await this.reconcileProviderSubscription(
          evento.providerSubscriptionId,
          evento.providerEventId,
        );
        await this.repository.finishEvent(evento.id, 'PROCESSED');
        resumo.processed += 1;
      } catch (error) {
        if (error instanceof BillingProviderUnavailableException) {
          /**
           * O provedor não respondeu. O evento continua pendente e ninguém é
           * suspenso por isso — a próxima passagem tenta de novo.
           */
          resumo.deferred += 1;
          continue;
        }
        await this.repository.finishEvent(
          evento.id,
          'FAILED',
          error instanceof Error ? error.name.slice(0, 80) : 'UNKNOWN',
        );
        resumo.failed += 1;
      }
    }

    if (resumo.examined > 0) {
      this.logger.log(
        JSON.stringify({ stage: 'billing-inbox-drained', ...resumo }),
      );
    }
    return resumo;
  }

  /**
   * A varredura periódica.
   *
   * O webhook não é a única defesa: entrega perdida, worker parado e
   * processamento falho convergem aqui, perguntando ao provedor o estado das
   * assinaturas que **já conhecemos** — nunca varrendo o provedor inteiro.
   */
  async reconcileLinkedSubscriptions(): Promise<BillingReconciliationSummary> {
    const resumo = {
      examined: 0,
      processed: 0,
      ignored: 0,
      failed: 0,
      deferred: 0,
    };
    if (!this.provider.isEnabled()) return resumo;

    let cursor: string | undefined;
    for (;;) {
      const lote = await this.repository.linkedSubscriptions(LOTE, cursor);
      if (lote.length === 0) break;
      cursor = lote[lote.length - 1]!.id;

      for (const assinatura of lote) {
        resumo.examined += 1;
        try {
          await this.reconcileProviderSubscription(
            assinatura.providerSubscriptionId!,
            null,
          );
          resumo.processed += 1;
        } catch (error) {
          if (error instanceof BillingProviderUnavailableException) {
            resumo.deferred += 1;
            continue;
          }
          resumo.failed += 1;
        }
      }
      if (lote.length < LOTE) break;
    }
    return resumo;
  }

  /**
   * Busca o estado canônico e aplica o comando correspondente.
   *
   * Este é o único ponto que traduz provedor em ciclo de vida. Um `if` sobre
   * estado de provedor em qualquer outro arquivo seria uma segunda tradução,
   * e duas traduções divergem.
   */
  async reconcileProviderSubscription(
    providerSubscriptionId: string,
    providerEventId: string | null,
  ): Promise<void> {
    const provedor = await this.provider.retrieveSubscription(
      providerSubscriptionId,
    );
    const local = await this.repository.findSubscriptionByProviderId(
      providerSubscriptionId,
    );
    if (!local) {
      /**
       * Assinatura do provedor sem par no Orbit.
       *
       * Acontece enquanto a contratação está em andamento: a sessão foi criada
       * e o vínculo ainda não. Ignorar é correto — a próxima varredura, depois
       * do vínculo, reconcilia.
       */
      this.logger.warn(
        JSON.stringify({
          stage: 'billing-subscription-unlinked',
          rawStatus: provedor.rawStatus,
        }),
      );
      return;
    }

    /**
     * A partir daqui, o worker fala como aquele inquilino.
     *
     * Ele chegou até aqui sem contexto nenhum — o evento veio do provedor, e
     * só a consulta acima revelou de quem era. Ler e escrever a assinatura sob
     * RLS exige o contexto declarado, e declará-lo **depois** de resolver a
     * organização é o que impede um evento de tocar o inquilino errado. Sem
     * isso, as leituras voltavam vazias e a reconciliação não fazia nada,
     * silenciosamente.
     */
    await this.comoInquilino(local.organizationId, async () => {
      const atual = await this.subscriptions.currentOrNull(
        local.organizationId,
      );
      if (!atual) return;
      await this.aplicar(atual, provedor, providerEventId);
    });
  }

  /**
   * Um contexto de inquilino recém-construído, e nada herdado.
   *
   * O ator é o sistema: nenhum usuário pediu isto, e nenhum papel é
   * emprestado. O contexto nasce aqui, vale para esta reconciliação e morre
   * com ela — não há como o contexto de um evento vazar para o próximo.
   */
  private comoInquilino<T>(
    organizationId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.contexts.run(
      new RequestContext({
        requestId: randomUUID(),
        actorType: 'SYSTEM',
        userId: null,
        organizationId: organizationId as never,
        businessUnitId: null,
        businessUnitIds: [],
        roles: [],
        permissions: [],
        ip: null,
        userAgent: null,
        locale: 'pt-BR',
      }),
      work,
    );
  }

  private async aplicar(
    atual: {
      id: string;
      organizationId: string;
      version: number;
      effectiveStatus: SubscriptionStatus;
    },
    provedor: ProviderSubscription,
    providerEventId: string | null,
  ): Promise<void> {
    const comando = this.comandoPara(atual.effectiveStatus, provedor.state);
    if (comando === 'NONE') {
      await this.subscriptions.syncProviderSnapshot(atual.id, {
        providerStatus: provedor.rawStatus,
        providerPriceId: provedor.providerPriceId,
        providerLastEventId: providerEventId,
        cancelAtPeriodEnd: provedor.cancelAtPeriodEnd,
      });
      return;
    }

    if (comando === 'ACTIVATE') {
      await this.subscriptions.reportPaymentSucceeded(
        atual.organizationId,
        atual.version,
      );
    } else {
      await this.subscriptions.reportPaymentFailed(
        atual.organizationId,
        atual.version,
      );
    }

    await this.subscriptions.syncProviderSnapshot(atual.id, {
      providerStatus: provedor.rawStatus,
      providerPriceId: provedor.providerPriceId,
      providerLastEventId: providerEventId,
      cancelAtPeriodEnd: provedor.cancelAtPeriodEnd,
    });
  }

  /**
   * O que fazer, dado onde estamos e o que o provedor diz.
   *
   * `UNKNOWN` e `INCOMPLETE` nunca ativam: um estado que este código não
   * conhece, ou uma assinatura sem primeiro pagamento, não podem virar plano
   * pago liberado.
   */
  private comandoPara(
    atual: SubscriptionStatus,
    provedor: ProviderBillingState,
  ): 'ACTIVATE' | 'FAIL' | 'NONE' {
    if (
      provedor === ProviderBillingState.UNKNOWN ||
      provedor === ProviderBillingState.INCOMPLETE
    ) {
      return 'NONE';
    }
    if (
      provedor === ProviderBillingState.ACTIVE ||
      provedor === ProviderBillingState.TRIALING
    ) {
      return atual === SubscriptionStatus.ACTIVE ? 'NONE' : 'ACTIVATE';
    }
    if (provedor === ProviderBillingState.PAYMENT_FAILED) {
      /** Já sem acesso, ou já em carência: não recomeça o relógio. */
      if (!grantsProductAccess(atual)) return 'NONE';
      return atual === SubscriptionStatus.GRACE_PERIOD ? 'NONE' : 'FAIL';
    }
    /** `ENDED`: o encerramento é do ciclo do Orbit, e a projeção já o conduz. */
    return 'NONE';
  }
}
