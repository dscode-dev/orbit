/**
 * Orçamento decidido → receita prevista.
 *
 * ## Aprovar não é receber
 *
 * Uma proposta aprovada cria `FinancialEntry(INCOME, **PENDING**)`. Nunca
 * `CONFIRMED`: o trabalho não foi feito e o dinheiro não entrou. Lançar como
 * realizado inflaria o caixa com expectativa — exatamente o que a separação
 * entre previsto e realizado da PR-21 existe para impedir.
 *
 * ## Por que um job, e não uma chamada direta
 *
 * O evento é enfileirado **dentro da transação** que muda o estado do
 * orçamento. Chamada direta abriria uma janela: o processo morre entre a
 * aprovação e o lançamento, e a proposta fica aprovada sem previsão nenhuma —
 * perda silenciosa, do tipo que ninguém descobre porque nada falhou.
 *
 * ## Idempotência
 *
 * O lançamento é criado por `recordFromSource`, cuja unicidade é do banco:
 * índice parcial em `(organization_id, source, source_entity_id)`. Retry,
 * concorrência e job devolvido pelo tempo limite convergem para **um**
 * lançamento. O cancelamento é idempotente por natureza — já cancelado, nada a
 * fazer.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { FinancialEntrySource, QuoteStatus } from '../../contracts';
import { FinancialService } from '../financial/financial.service';
import {
  JOB_QUEUES,
  type BackgroundJobRecord,
  type JobProcessor,
  type JobQueue,
} from '../jobs/background-job.types';
import { JobProcessorRegistry } from '../jobs/job-processor.registry';
import { QuoteRepository } from './quote.repository';

@Injectable()
export class QuoteFinancialProcessor implements JobProcessor, OnModuleInit {
  readonly queue: JobQueue = JOB_QUEUES.quoteStatusChanged;

  private readonly logger = new Logger(QuoteFinancialProcessor.name);

  constructor(
    private readonly quotes: QuoteRepository,
    private readonly financial: FinancialService,
    private readonly registry: JobProcessorRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async process(job: BackgroundJobRecord): Promise<void> {
    const quoteId = job.payload.quoteId;
    const status = job.payload.status;
    if (typeof quoteId !== 'string' || typeof status !== 'string') {
      this.logger.warn(`[quotes] job com payload inesperado: ${job.id}`);
      return;
    }

    const quote = await this.quotes.find(quoteId, job.organizationId);
    if (!quote) return;

    /**
     * O estado atual manda, não o do payload.
     *
     * Um job atrasado pode chegar depois de o orçamento ter mudado de novo —
     * aprovado e cancelado em seguida. Reagir ao que o payload dizia recriaria
     * uma previsão que já tinha sido cancelada.
     */
    if (quote.status === QuoteStatus.APPROVED) {
      const entry = await this.financial.recordFromSource({
        organizationId: job.organizationId,
        businessUnitId: quote.businessUnit.id,
        source: FinancialEntrySource.QUOTE,
        /** Identidade do lançamento: o orçamento. Um por proposta aprovada. */
        sourceEntityId: quote.id,
        amount: quote.total.toString(),
        currency: quote.currency,
        description: `Orçamento ${quote.code} — ${quote.title}`,
        /** Competência é a decisão; vencimento previsto é a validade. */
        competenceDate: quote.decidedAt ?? new Date(),
        dueDate: quote.validUntil,
        customerId: quote.customer.id,
        operationId: quote.operationId,
        status: 'PENDING',
        metadata: {
          quoteId: quote.id,
          quoteCode: quote.code,
          quoteNumber: quote.number,
        },
        actorId: quote.decidedBy?.id ?? job.actorUserId ?? quote.createdBy.id,
      });

      this.logger.log(
        entry
          ? `[quotes] ${quote.code} lançado como receita prevista ${entry.id}`
          : `[quotes] ${quote.code} já possuía receita prevista; nada a fazer`,
      );
      return;
    }

    if (quote.status === QuoteStatus.CANCELLED) {
      const cancelled = await this.financial.cancelFromSource({
        organizationId: job.organizationId,
        source: FinancialEntrySource.QUOTE,
        sourceEntityId: quote.id,
        reason: `Orçamento ${quote.code} cancelado: ${quote.closingReason ?? 'sem motivo informado'}`,
        actorId: job.actorUserId ?? quote.createdBy.id,
      });

      this.logger.log(
        cancelled
          ? `[quotes] receita prevista de ${quote.code} cancelada`
          : `[quotes] ${quote.code} não tinha receita prevista a cancelar`,
      );
    }
  }
}
