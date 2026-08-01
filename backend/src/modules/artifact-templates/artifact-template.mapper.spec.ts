import { ArtifactTemplateReadModelMapper } from './artifact-template.mapper';

describe('ArtifactTemplateReadModelMapper', () => {
  const mapper = new ArtifactTemplateReadModelMapper();

  it('publishes the current immutable version without leaking internal fields', () => {
    const result = mapper.details({
      id: 'template-id',
      organizationId: 'organization-id',
      key: 'SERVICE_ORDER',
      name: 'Service order',
      description: null,
      artifactType: 'SERVICE_ORDER',
      segment: 'HVAC_R',
      status: 'ACTIVE',
      visibility: 'ORGANIZATION',
      tags: ['field'],
      sortOrder: 0,
      currentVersion: 2,
      source: 'NATIVE',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T01:00:00Z'),
      versions: [
        {
          id: 'version-id',
          templateId: 'template-id',
          organizationId: 'organization-id',
          createdById: 'actor-id',
          version: 2,
          metadata: { locale: 'pt-BR' },
          sections: [],
          signatureSlots: [],
          layout: {},
          changeSummary: 'Changed structure',
          createdAt: new Date('2026-08-01T01:00:00Z'),
        },
      ],
    });

    expect(result.current.version).toBe(2);
    expect(result.current.layout.reusableBlocks).toEqual([]);
    expect(result).not.toHaveProperty('deletedAt');
    expect(result.current).not.toHaveProperty('template');
  });
});
