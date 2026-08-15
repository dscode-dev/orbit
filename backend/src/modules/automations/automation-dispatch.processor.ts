/**
 * Evento → regras → ações agendadas.
 *
 * ```
 * automation.dispatch          automation.action (× N, cada uma com seu prazo)
 *   evento                       ação
 *   regras da organização        idempotente por (evento, regra, ação)
 *   condições                    executa e fecha a linha
 * ```
 *
 * ## Por que dois passos
 *
 * O despacho é rápido e sem efeito externo: lê regras, avalia condições e
 * registra o que deve acontecer. A execução é lenta, pode falhar e pode ser
 * **futura** — separar as duas permite que a ação de daqui a seis meses seja um
 * job pendente, e que a falha de uma ação não force reavaliar as regras.
 *
 * ## O worker reabre o contexto do tenant
 *
 * Como no Rendering Engine: o job carrega organização e unidade, e
 * `BackgroundJobWorker` reabre o `RequestContext` antes de chamar o
 * processador. Nenhuma consulta daqui roda como administrador da plataforma —
 * a RLS é a mesma de uma requisição.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BackgroundJobQueue } from '../jobs/background-job.queue';
import {
  JOB_QUEUES,
  inheritScope,
  type BackgroundJobRecord,
  type JobProcessor,
  type JobQueue,
} from '../jobs/background-job.types';
import { JobProcessorRegistry } from '../jobs/job-processor.registry';
import {
  findAction,
  type RuleAction,
  type RuleCondition,
} from './automation.catalog';
import { evaluate } from './automation.evaluator';
import { AutomationRepository } from './automation.repository';

@Injectable()
export class AutomationDispatchProcessor implements JobProcessor, OnModuleInit {
  readonly queue: JobQueue = JOB_QUEUES.automationDispatch;

  private readonly logger = new Logger(AutomationDispatchProcessor.name);

  constructor(
    private readonly repository: AutomationRepository,
    private readonly jobs: BackgroundJobQueue,
    private readonly registry: JobProcessorRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async process(job: BackgroundJobRecord): Promise<void> {
    const eventId = job.payload.eventId;
    if (typeof eventId !== 'string') {
      this.logger.warn(`[automations] despacho sem eventId: ${job.id}`);
      return;
    }

    const event = await this.repository.findEvent(eventId, job.organizationId);
    if (!event) {
      /**
       * Evento sumiu — organização removida entre a emissão e o despacho.
       * Nada a fazer, e repetir não traria de volta.
       */
      this.logger.warn(`[automations] evento não encontrado: ${eventId}`);
      return;
    }

    const rules = await this.repository.matchingRules(
      job.organizationId,
      event.type,
      event.businessUnitId,
    );

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    let scheduled = 0;
    let skipped = 0;

    for (const rule of rules) {
      const conditions = (rule.conditions ?? []) as unknown as RuleCondition[];
      const result = evaluate(conditions, payload);

      if (!result.matched) {
        skipped += 1;
        this.logger.log(
          JSON.stringify({
            stage: 'rule-skipped',
            eventId,
            correlationId: event.correlationId,
            ruleId: rule.id,
            reason: result.failedOn,
          }),
        );
        continue;
      }

      const actions = (rule.actions ?? []) as unknown as RuleAction[];
      for (const action of actions) {
        const definition = findAction(action.type);

        /**
         * Ação declarada indisponível não é erro — é limite conhecido.
         *
         * A execução é registrada como `SKIPPED` com o motivo, para que a
         * regra mostre que tentou e por que não seguiu. Silenciar produziria
         * uma automação que parece funcionar e não faz nada.
         */
        if (!definition || !definition.available) {
          await this.repository.schedule({
            organizationId: job.organizationId,
            eventId,
            ruleId: rule.id,
            actionId: action.id,
            actionType: action.type,
            scheduledFor: null,
            correlationId: event.correlationId,
          });
          const claimed = await this.repository.claim(
            eventId,
            rule.id,
            action.id,
          );
          if (claimed) {
            await this.repository.finish({
              id: claimed.id,
              status: 'SKIPPED',
              detail:
                definition?.unavailableReason ??
                `Ação ${action.type} não é executável por este motor.`,
            });
          }
          skipped += 1;
          continue;
        }

        const scheduledFor = await this.repository.resolveDelay(
          action.delay ?? null,
        );

        const created = await this.repository.schedule({
          organizationId: job.organizationId,
          eventId,
          ruleId: rule.id,
          actionId: action.id,
          actionType: action.type,
          scheduledFor,
          correlationId: event.correlationId,
        });

        /** Já agendada por um despacho anterior: reentrega, não trabalho novo. */
        if (!created) continue;

        await this.jobs.enqueue({
          queue: JOB_QUEUES.automationAction,
          /** A chave é a identidade da ação — a mesma da linha de execução. */
          jobKey: `${eventId}:${rule.id}:${action.id}`,
          organizationId: job.organizationId,
          /** A ação nunca enxerga mais do que o despacho que a gerou. */
          ...inheritScope(job),
          payload: {
            eventId,
            ruleId: rule.id,
            actionId: action.id,
          },
          correlationId: event.correlationId,
          actorUserId: event.actorId,
          availableAt: scheduledFor ?? undefined,
        });
        scheduled += 1;
      }
    }

    this.logger.log(
      JSON.stringify({
        stage: 'dispatched',
        eventId,
        correlationId: event.correlationId,
        type: event.type,
        rulesEvaluated: rules.length,
        actionsScheduled: scheduled,
        skipped,
      }),
    );
  }
}
