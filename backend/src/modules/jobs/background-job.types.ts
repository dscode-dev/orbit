/**
 * Contrato da fila de trabalho assíncrono.
 *
 * ## Por que Postgres, e não uma fila dedicada
 *
 * O Orbit **não adotou mensageria**: não há Redis, BullMQ, RabbitMQ nem Kafka
 * no projeto — só Postgres e Socket.IO. O enunciado desta PR pede para não
 * criar infraestrutura paralela de jobs se já existir mecanismo reutilizável;
 * como não existia, a escolha foi entre acrescentar um componente ao deploy ou
 * usar o que já está lá.
 *
 * Postgres com `FOR UPDATE SKIP LOCKED` entrega o que a PR exige — exclusão
 * mútua entre réplicas, idempotência, retry, backoff, dead-letter — sem um
 * serviço novo para operar, monitorar e proteger. A mesma transação que grava o
 * resultado do trabalho fecha o job: não existe janela em que um renderizou e o
 * outro acha que ainda não.
 *
 * O limite honesto: isto atende dezenas de jobs por segundo, não milhares. Se o
 * volume exigir, a troca por uma fila dedicada é substituir `BackgroundJobQueue`
 * — nenhum processador conhece Postgres.
 */

export const JOB_STATUSES = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'DEAD',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Filas conhecidas. Uma constante evita fila nomeada por engano. */
export const JOB_QUEUES = {
  artifactRender: 'artifact.render',
  /**
   * Manifesto emitido.
   *
   * Nomeada pelo **evento**, não por quem consome. O módulo que emite o
   * manifesto não sabe que existe Financeiro, e não deveria: se amanhã o
   * evento interessar a notificações ou a um webhook, ninguém volta aqui para
   * renomear a fila.
   */
  artifactManifestIssued: 'artifact.manifest.issued',
} as const;
export type JobQueue = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];

export interface EnqueueJobInput {
  queue: JobQueue;
  /**
   * Chave de idempotência.
   *
   * Enquanto houver job pendente ou rodando com esta chave, enfileirar de novo
   * devolve o existente em vez de criar um segundo.
   */
  jobKey: string;
  organizationId: string;
  businessUnitId?: string | null;
  payload: Record<string, unknown>;
  correlationId: string;
  actorUserId?: string | null;
  maxAttempts?: number;
}

export interface BackgroundJobRecord {
  id: string;
  queue: string;
  jobKey: string;
  organizationId: string;
  businessUnitId: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  correlationId: string;
  actorUserId: string | null;
  lastError: string | null;
  availableAt: Date;
  createdAt: Date;
}

/**
 * Quem sabe executar uma fila.
 *
 * O processador **não conhece a fila**: recebe o job e devolve, ou lança. Se
 * lançar, a política de retry decide entre repetir e mandar para dead-letter.
 */
export interface JobProcessor {
  readonly queue: JobQueue;
  process(job: BackgroundJobRecord): Promise<void>;
}

/**
 * Erro que não deve ser repetido.
 *
 * Um payload inválido ou uma execução que não existe mais não melhoram na
 * terceira tentativa — repetir só gasta janela de trabalho e polui o log.
 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

/**
 * Processadores se inscrevem em `JobProcessorRegistry`.
 *
 * O token multi-provider que existia aqui só enxergava o módulo onde o worker
 * é declarado — ver o comentário do registro.
 */
