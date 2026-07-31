import { ValidationException } from '../../exceptions';
import type { PdfRendererService } from '../document-engine/pdf-renderer.service';
import type { ReportTemplateRepository } from './report-template.repository';
import { ReportTemplateService } from './report-template.service';

describe('ReportTemplateService', () => {
  const repository = { create: jest.fn() };
  const renderer = { render: jest.fn() };
  const service = new ReportTemplateService(
    repository as unknown as ReportTemplateRepository,
    renderer as unknown as PdfRendererService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects duplicate section keys', async () => {
    await expect(
      service.create('organization-id', {
        key: 'TECHNICAL',
        name: 'Relatório técnico',
        reportKind: 'TECHNICAL',
        sections: [
          {
            key: 'summary',
            title: 'Resumo',
            type: 'TEXT',
            order: 0,
            content: 'A',
          },
          {
            key: 'summary',
            title: 'Conclusão',
            type: 'TEXT',
            order: 1,
            content: 'B',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('requires table columns and a data path', async () => {
    await expect(
      service.create('organization-id', {
        key: 'TECHNICAL',
        name: 'Relatório técnico',
        reportKind: 'TECHNICAL',
        sections: [
          {
            key: 'items',
            title: 'Itens',
            type: 'TABLE',
            order: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
