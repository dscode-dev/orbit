import { PdfRendererService } from './pdf-renderer.service';

describe('PdfRendererService', () => {
  it('renders a valid PDF with versioned document metadata', async () => {
    const renderer = new PdfRendererService();
    const pdf = await renderer.render({
      title: 'Relatório técnico',
      code: 'RT-001',
      version: 2,
      sections: [
        {
          key: 'summary',
          title: 'Resumo',
          type: 'TEXT',
          order: 0,
          content: 'Cliente: {{customer.name}}',
        },
      ],
      signatureSlots: [],
      settings: { pageSize: 'A4', showPageNumbers: true },
      data: { customer: { name: 'Orbit Cliente' } },
      signatures: [],
      contentHash: 'a'.repeat(64),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
