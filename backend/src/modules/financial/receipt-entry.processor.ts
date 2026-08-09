/**
 * Recibo emitido → receita confirmada.
 *
 * ## O gatilho é o evento de negócio
 *
 * A fila é `artifact.manifest.issued`, alimentada pela transação que grava
 * `issuedAt`. Não é "PDF renderizado": renderizar produz bytes, e bytes não
 * são documento emitido — `confirmFile` emite um arquivo enviado de fora, sem
 * renderer nenhum, e uma renderização que falha ao emitir não gerou recibo
 * algum. Amarrar o Financeiro ao renderer criaria receita a partir de um
 * rascunho.
 *
 * ## Nada aqui é acoplado ao Rendering Engine
 *
 * Este processador não conhece renderer, storage nem template. Lê o manifesto
 * emitido, pergunta se aquele tipo de artefato representa dinheiro recebido, e
 * só então lança.
 *
 * ## Quando não lançar
 *
 * - o artefato não é recibo;
 * - a organização desligou `autoRecordReceipts`;
 * - **o valor não pôde ser resolvido com confiança**.
 *
 * O último caso é o que mais importa: um lançamento de R$ 0,00, ou um valor
 * adivinhado entre vários campos numéricos, é pior que lançamento nenhum —
 * ninguém confere o que não sabe que está errado. O job termina com sucesso e
 * deixa registro no log; repetir não melhoraria nada.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { FinancialEntrySource } from '../../contracts';
import {
  JOB_QUEUES,
  type BackgroundJobRecord,
  type JobProcessor,
  type JobQueue,
} from '../jobs/background-job.types';
import { JobProcessorRegistry } from '../jobs/job-processor.registry';
import {
  MONETARY_FIELD_TYPES,
  RECEIPT_ARTIFACT_TYPES,
  SUPPORTED_CURRENCIES,
} from './financial.constants';
import { FinancialRepository } from './financial.repository';
import { FinancialService } from './financial.service';

interface ResponseRow {
  sectionId: string;
  fieldId: string;
  value: unknown;
  valueType: string;
  unit: string | null;
}

interface ResolvedAmount {
  amount: string;
  currency: string;
}

@Injectable()
export class ReceiptEntryProcessor implements JobProcessor, OnModuleInit {
  readonly queue: JobQueue = JOB_QUEUES.artifactManifestIssued;

  private readonly logger = new Logger(ReceiptEntryProcessor.name);

  constructor(
    private readonly repository: FinancialRepository,
    private readonly financial: FinancialService,
    private readonly registry: JobProcessorRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async process(job: BackgroundJobRecord): Promise<void> {
    const manifestId = job.payload.manifestId;
    if (typeof manifestId !== 'string') {
      /**
       * Payload malformado não melhora repetindo, mas também não é falha
       * digna de dead-letter: significa que quem enfileirou mudou de forma.
       */
      this.logger.warn(`[financial] job sem manifestId: ${job.id}`);
      return;
    }

    const document = await this.repository.findIssuedDocument(
      manifestId,
      job.organizationId,
    );
    if (!document || document.status !== 'ISSUED') return;

    const artifactType = document.snapshot.artifactType;
    if (!RECEIPT_ARTIFACT_TYPES.includes(artifactType)) return;

    const settings = await this.repository.ensureSettings(job.organizationId);
    if (!settings.autoRecordReceipts) {
      this.logger.log(
        `[financial] recibo ${manifestId} não lançado: registro automático desligado`,
      );
      return;
    }

    const responses = document.execution.responses as ResponseRow[];
    const resolved = this.resolveAmount(responses);
    if (!resolved) {
      this.logger.warn(
        `[financial] recibo ${manifestId} sem valor monetário resolvível; nenhum lançamento criado`,
      );
      return;
    }

    const entry = await this.financial.recordFromSource({
      organizationId: job.organizationId,
      businessUnitId:
        document.businessUnitId ?? document.execution.businessUnitId,
      source: FinancialEntrySource.RECEIPT,
      /**
       * A identidade do lançamento é o **manifesto**, não a execução: uma
       * execução pode ter várias revisões emitidas, e cada emissão é um
       * documento próprio. É esta chave que o índice único do banco protege.
       */
      sourceEntityId: document.id,
      amount: resolved.amount,
      currency: resolved.currency,
      description: this.describe(document.execution.title, artifactType),
      competenceDate: this.competence(responses, document.issuedAt),
      customerId: document.execution.customerId,
      operationId: document.execution.operationId,
      metadata: {
        manifestId: document.id,
        executionId: document.execution.id,
        executionCode: document.execution.code,
        artifactType,
      },
      actorId: document.issuedById ?? job.actorUserId ?? '',
    });

    this.logger.log(
      entry
        ? `[financial] recibo ${manifestId} lançado como ${entry.id}`
        : `[financial] recibo ${manifestId} já possuía lançamento; nada a fazer`,
    );
  }

  /**
   * Encontra o valor pela **unidade**, não pelo nome do campo.
   *
   * Procurar `valor` amarraria o Financeiro ao template oficial e falharia no
   * primeiro recibo que a organização desenhar do seu jeito. O que identifica
   * dinheiro é um campo numérico cuja unidade é código de moeda — informação
   * que o próprio contrato do template já carrega.
   *
   * Mais de um campo monetário e nenhum lançamento: somar dois valores que
   * podem ser total e desconto inventaria um número, e escolher o primeiro
   * seria pior ainda, porque pareceria certo.
   */
  private resolveAmount(
    responses: readonly ResponseRow[],
  ): ResolvedAmount | null {
    const monetary = responses.filter(
      (row) =>
        MONETARY_FIELD_TYPES.includes(row.valueType) &&
        row.unit !== null &&
        SUPPORTED_CURRENCIES.includes(row.unit.toUpperCase()),
    );
    const row = monetary.length === 1 ? monetary[0] : undefined;
    if (!row || row.unit === null) return null;

    const amount = this.number(row.value);
    if (amount === null || amount <= 0) return null;

    return {
      amount: amount.toFixed(2),
      currency: row.unit.toUpperCase(),
    };
  }

  /**
   * Competência: a data que o documento declara.
   *
   * Um recibo emitido no dia 3 referente a um pagamento do dia 28 pertence ao
   * mês do pagamento — usar a emissão jogaria a receita para o mês seguinte e
   * faria o fechamento discordar do documento assinado. Só vale quando o
   * documento tem **uma** data; com várias, não há como saber qual é a do
   * dinheiro, e aí a emissão é a resposta honesta.
   */
  private competence(
    responses: readonly ResponseRow[],
    issuedAt: Date | null,
  ): Date {
    const dates = responses.filter((row) => row.valueType === 'DATE');
    const only = dates.length === 1 ? dates[0] : undefined;
    if (only) {
      const parsed = this.date(only.value);
      if (parsed) return parsed;
    }
    return issuedAt ?? new Date();
  }

  private describe(title: string, artifactType: string): string {
    const label = artifactType === 'RECIBO' ? 'Recibo' : artifactType;
    return `${label} — ${title}`.slice(0, 255);
  }

  private number(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private date(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
