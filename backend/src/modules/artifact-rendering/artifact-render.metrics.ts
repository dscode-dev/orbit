/**
 * Métricas da renderização (Stage 8).
 *
 * ## Por que contadores em memória, e não um cliente de métricas
 *
 * O Orbit não adotou Prometheus, OpenTelemetry nem qualquer coletor — não há
 * registro de métricas no projeto. Trazer um cliente agora significaria também
 * decidir endpoint de scrape, formato e retenção, que é uma escolha de
 * infraestrutura maior do que esta PR.
 *
 * O que existe aqui atende o pedido sem essa decisão: **contadores em memória**
 * legíveis por endpoint autenticado, e **uma linha estruturada por evento** no
 * log, que é o caminho que o resto da plataforma já usa
 * (`LoggingInterceptor`). Um coletor de verdade lê o log estruturado sem
 * mudança de código, e o dia em que houver registro de métricas esta classe
 * vira um adaptador.
 *
 * Os contadores **reiniciam com o processo** e não somam entre réplicas. Está
 * dito no Read Model: são um instantâneo do processo, não a métrica oficial da
 * plataforma.
 */
import { Injectable, Logger } from '@nestjs/common';

export interface RenderMetricsSnapshot {
  /** Instante em que o processo começou a contar. */
  since: string;
  started: number;
  succeeded: number;
  failed: number;
  retried: number;
  /** Duração acumulada e média, em milissegundos. */
  durationMsTotal: number;
  durationMsAverage: number;
  /** Bytes acumulados e média por documento. */
  bytesTotal: number;
  bytesAverage: number;
  byRenderer: Readonly<Record<string, RendererCounters>>;
}

export interface RendererCounters {
  started: number;
  succeeded: number;
  failed: number;
  durationMsTotal: number;
  bytesTotal: number;
}

@Injectable()
export class ArtifactRenderMetrics {
  private readonly logger = new Logger('ArtifactRender');
  private readonly since = new Date();
  private started = 0;
  private succeeded = 0;
  private failed = 0;
  private retried = 0;
  private durationMsTotal = 0;
  private bytesTotal = 0;
  private readonly byRenderer = new Map<string, RendererCounters>();

  recordStart(
    renderer: string,
    correlationId: string,
    executionId: string,
  ): void {
    this.started += 1;
    this.counters(renderer).started += 1;
    this.log('started', { renderer, correlationId, executionId });
  }

  recordSuccess(input: {
    renderer: string;
    correlationId: string;
    executionId: string;
    manifestId: string;
    revision: number;
    durationMs: number;
    bytes: number;
    attempt: number;
  }): void {
    this.succeeded += 1;
    this.durationMsTotal += input.durationMs;
    this.bytesTotal += input.bytes;

    const counters = this.counters(input.renderer);
    counters.succeeded += 1;
    counters.durationMsTotal += input.durationMs;
    counters.bytesTotal += input.bytes;

    this.log('succeeded', input);
  }

  recordFailure(input: {
    renderer: string;
    correlationId: string;
    executionId: string;
    durationMs: number;
    attempt: number;
    permanent: boolean;
    reason: string;
  }): void {
    this.failed += 1;
    this.counters(input.renderer).failed += 1;
    this.log('failed', input);
  }

  recordRetry(renderer: string, correlationId: string, attempt: number): void {
    this.retried += 1;
    this.log('retried', { renderer, correlationId, attempt });
  }

  snapshot(): RenderMetricsSnapshot {
    return {
      since: this.since.toISOString(),
      started: this.started,
      succeeded: this.succeeded,
      failed: this.failed,
      retried: this.retried,
      durationMsTotal: this.durationMsTotal,
      durationMsAverage: this.succeeded
        ? Math.round(this.durationMsTotal / this.succeeded)
        : 0,
      bytesTotal: this.bytesTotal,
      bytesAverage: this.succeeded
        ? Math.round(this.bytesTotal / this.succeeded)
        : 0,
      byRenderer: Object.fromEntries(this.byRenderer),
    };
  }

  private counters(renderer: string): RendererCounters {
    const existing = this.byRenderer.get(renderer);
    if (existing) return existing;

    const counters: RendererCounters = {
      started: 0,
      succeeded: 0,
      failed: 0,
      durationMsTotal: 0,
      bytesTotal: 0,
    };
    this.byRenderer.set(renderer, counters);
    return counters;
  }

  /** Uma linha por evento, no mesmo formato do resto da plataforma. */
  private log(event: string, payload: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event: `render.${event}`, ...payload }));
  }
}
