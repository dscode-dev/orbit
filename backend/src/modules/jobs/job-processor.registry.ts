/**
 * Onde os processadores se anunciam.
 *
 * ## Por que um registro, e não um token multi-provider
 *
 * O desenho anterior injetava um array por `JOB_PROCESSOR`, montado no módulo
 * que também hospeda o worker. Funcionava com uma fila só: o worker enxergava
 * exatamente os processadores declarados ao lado dele. Com a segunda fila —
 * vinda de outro módulo, que o módulo do worker não importa e não deve
 * importar — o array continuaria com um item, e o segundo processador nunca
 * rodaria. Silenciosamente: nenhum erro, nenhum job processado.
 *
 * O registro é global, como a fila. Cada processador se inscreve ao subir, e o
 * worker percorre o que estiver inscrito. Acrescentar uma fila deixa de exigir
 * qualquer alteração em quem executa.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { JobProcessor } from './background-job.types';

@Injectable()
export class JobProcessorRegistry {
  private readonly logger = new Logger(JobProcessorRegistry.name);
  private readonly processors = new Map<string, JobProcessor>();

  /**
   * Inscreve um processador.
   *
   * Uma fila tem um dono. Dois processadores para a mesma fila competiriam
   * pelos mesmos jobs, e qual venceria dependeria da ordem de inicialização —
   * a classe de defeito que só aparece em produção.
   */
  register(processor: JobProcessor): void {
    const existing = this.processors.get(processor.queue);
    if (existing && existing !== processor) {
      throw new Error(
        `[jobs] fila ${processor.queue} já possui processador registrado`,
      );
    }
    this.processors.set(processor.queue, processor);
    this.logger.log(`[jobs] processador registrado: ${processor.queue}`);
  }

  all(): readonly JobProcessor[] {
    return [...this.processors.values()];
  }
}
