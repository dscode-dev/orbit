/**
 * O hash e a composição, sem banco.
 *
 * O que se prova aqui é o que sustenta a palavra "reproduzível": mesmo
 * conteúdo, mesmo hash; conteúdo diferente, hash diferente; e o instante da
 * geração não conta. Um snapshot cujo hash muda sozinho não serve de prova de
 * nada.
 */
import { ReportComposer } from './report.composer';
import type { ReportSnapshotReadModel } from './report.read-models';

const snapshot = (
  overrides: Partial<ReportSnapshotReadModel> = {},
): ReportSnapshotReadModel => ({
  schemaVersion: 1,
  type: 'OPERATIONS_PERFORMANCE',
  name: 'Desempenho operacional',
  period: {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-31T23:59:59.000Z',
    timezone: 'America/Recife',
  },
  scope: {
    organizationId: 'org-1',
    businessUnitId: null,
    businessUnitName: null,
  },
  parameters: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
  sections: [
    {
      id: 'operations.volume',
      title: 'Volume',
      metrics: [
        {
          id: 'operations.opened',
          label: 'Abertas',
          value: '12',
          source: 'operations',
          provenance: 'OBSERVED',
        },
      ],
      tables: [],
    },
  ],
  sources: [
    {
      domain: 'OPERATIONS',
      source: 'operations',
      provenance: 'OBSERVED',
      included: true,
    },
  ],
  generatedAt: '2026-02-01T10:00:00.000Z',
  ...overrides,
});

describe('ReportComposer.hash', () => {
  it('mesmos dados, mesmo hash', () => {
    expect(ReportComposer.hash(snapshot())).toBe(
      ReportComposer.hash(snapshot()),
    );
  });

  /** É o que permite o hash falar sobre os números, e não sobre o relógio. */
  it('o instante da geração não entra no hash', () => {
    const early = snapshot({ generatedAt: '2026-02-01T10:00:00.000Z' });
    const late = snapshot({ generatedAt: '2027-09-14T23:11:02.000Z' });
    expect(ReportComposer.hash(early)).toBe(ReportComposer.hash(late));
  });

  it('um número diferente muda o hash', () => {
    const changed = snapshot();
    const section = changed.sections[0]!;
    const metric = { ...section.metrics[0]!, value: '13' };
    const next = snapshot({
      sections: [{ ...section, metrics: [metric] }],
    });
    expect(ReportComposer.hash(next)).not.toBe(ReportComposer.hash(snapshot()));
  });

  it('período diferente muda o hash', () => {
    const next = snapshot({
      period: {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-28T23:59:59.000Z',
        timezone: 'America/Recife',
      },
    });
    expect(ReportComposer.hash(next)).not.toBe(ReportComposer.hash(snapshot()));
  });

  /** O fuso faz parte do recorte: o mesmo mês em outro fuso é outro retrato. */
  it('fuso diferente muda o hash', () => {
    const next = snapshot({
      period: { ...snapshot().period, timezone: 'Europe/Lisbon' },
    });
    expect(ReportComposer.hash(next)).not.toBe(ReportComposer.hash(snapshot()));
  });

  /**
   * A ordem das chaves é do código, não dos dados.
   *
   * Sem serialização canônica, mover um campo no objeto mudaria o hash — e o
   * relatório pareceria diferente sem que nenhum número tivesse mudado.
   */
  it('ordem das chaves não muda o hash', () => {
    const reordered = {
      generatedAt: snapshot().generatedAt,
      sources: snapshot().sources,
      sections: snapshot().sections,
      parameters: snapshot().parameters,
      scope: snapshot().scope,
      period: snapshot().period,
      name: snapshot().name,
      type: snapshot().type,
      schemaVersion: snapshot().schemaVersion,
    };
    expect(ReportComposer.hash(reordered)).toBe(
      ReportComposer.hash(snapshot()),
    );
  });
});
