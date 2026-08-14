/**
 * O aviso de vencimento, na fila que já existe.
 *
 * ```
 * plano ativado ──▶ dois jobs adiados ──▶ pmoc.due_soon / pmoc.overdue
 *                    (available_at)              │
 *                                        Automation Engine
 * ```
 *
 * ## Por que isto não é um cron
 *
 * Não há varredura periódica, não há tabela de agendamentos própria e não há
 * relógio paralelo. Cada plano, ao ganhar um vencimento, enfileira **dois** jobs
 * com `available_at` derivado dele: um para o dia em que entra na antecedência,
 * outro para o dia seguinte ao vencimento. Quando a manutenção é feita, o ciclo
 * seguinte enfileira os seus.
 *
 * ## Por que o estado continua correto sem ninguém abrir tela
 *
 * A conformidade **exibida** é calculada na leitura, com o relógio do servidor —
 * ela nunca fica velha. O que estes jobs acrescentam é o **fato observável**:
 * o evento de domínio que dispara automação, notificação e lembrete. Sem eles,
 * "vencido" só existiria para quem olhasse.
 *
 * ## Um aviso por vencimento
 *
 * `notify()` só emite se o plano ainda estiver ativo, no mesmo vencimento, e o
 * aviso daquele vencimento ainda não tiver saído — tudo num `UPDATE` condicional.
 * Retry da fila, job devolvido por tempo limite e reativação do plano convergem
 * para um evento.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  JOB_QUEUES,
  PermanentJobError,
  type BackgroundJobRecord,
  type JobProcessor,
  type JobQueue,
} from '../jobs/background-job.types';
import { JobProcessorRegistry } from '../jobs/job-processor.registry';
import { PmocRepository } from './pmoc.repository';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PmocDueProcessor implements JobProcessor, OnModuleInit {
  readonly queue: JobQueue = JOB_QUEUES.pmocDueCheck;

  private readonly logger = new Logger(PmocDueProcessor.name);

  constructor(
    private readonly repository: PmocRepository,
    private readonly registry: JobProcessorRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async process(job: BackgroundJobRecord): Promise<void> {
    const planId = job.payload.planId;
    const dueOn = job.payload.dueOn;
    const phase = job.payload.phase;

    if (
      typeof planId !== 'string' ||
      typeof dueOn !== 'string' ||
      (phase !== 'DUE_SOON' && phase !== 'OVERDUE')
    ) {
      throw new PermanentJobError('pmoc due job without identity');
    }

    const plan = await this.repository.findForNotification(
      planId,
      job.organizationId,
    );

    /** Plano removido entre o agendamento e o aviso. Repetir não o traz. */
    if (!plan) {
      this.logger.log(
        JSON.stringify({ stage: 'pmoc-plan-gone', planId, dueOn, phase }),
      );
      return;
    }

    const due = new Date(`${dueOn}T00:00:00.000Z`);
    const today = startOfToday();
    const days = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);

    /**
     * O vencimento mudou: a manutenção foi feita antes da hora, ou o plano foi
     * editado. O aviso deste vencimento não faz mais sentido, e o do novo já
     * foi enfileirado por quem o definiu.
     */
    if (
      !plan.nextDueOn ||
      plan.nextDueOn.toISOString().slice(0, 10) !== dueOn
    ) {
      this.logger.log(
        JSON.stringify({ stage: 'pmoc-due-moved', planId, dueOn, phase }),
      );
      return;
    }

    if (plan.status !== 'ACTIVE') {
      this.logger.log(
        JSON.stringify({
          stage: 'pmoc-plan-inactive',
          planId,
          dueOn,
          phase,
          status: plan.status,
        }),
      );
      return;
    }

    /**
     * Cedo demais para o aviso.
     *
     * Acontece quando o job foi reentregue antes da hora — a fila garante que
     * não roda **antes** de `available_at`, mas um retry logo após uma falha
     * pode chegar cedo. Sair sem emitir é o certo: o próximo ciclo de retry
     * chega na hora.
     */
    if (phase === 'DUE_SOON' && days > plan.dueSoonDays) return;
    if (phase === 'OVERDUE' && days >= 0) return;

    const emitted = await this.repository.notify({
      planId,
      organizationId: job.organizationId,
      phase,
      dueOn: due,
      days: phase === 'DUE_SOON' ? days : Math.abs(days),
      actorId: job.actorUserId,
    });

    this.logger.log(
      JSON.stringify({
        stage: emitted ? 'pmoc-notified' : 'pmoc-already-notified',
        planId,
        dueOn,
        phase,
        days,
        correlationId: job.correlationId,
      }),
    );
  }
}

/** Meia-noite UTC de hoje — a comparação é por dia, como no domínio. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
