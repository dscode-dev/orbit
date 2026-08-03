import { ArtifactManifestPolicy } from './artifact-manifest.policy';

describe('ArtifactManifestPolicy', () => {
  const policy = new ArtifactManifestPolicy();

  const manifest = (
    status: string,
    fileId: string | null = null,
    isActive = false,
  ) => ({ status, fileId, isActive });

  describe('emissão a partir da execução', () => {
    it.each(['UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'ARCHIVED'])(
      'permite emitir com a execução em %s',
      (status) => {
        expect(() =>
          policy.assertExecutionCanIssue({ status, organizationId: 'org' }),
        ).not.toThrow();
      },
    );

    it.each(['DRAFT', 'IN_PROGRESS', 'PAUSED'])(
      'recusa emitir com a execução em %s',
      (status) => {
        expect(() =>
          policy.assertExecutionCanIssue({ status, organizationId: 'org' }),
        ).toThrow(/cannot issue a document/);
      },
    );
  });

  describe('anexar conteúdo', () => {
    it('aceita apenas em rascunho sem arquivo', () => {
      expect(() => policy.assertCanAttachFile(manifest('DRAFT'))).not.toThrow();
    });

    it('recusa quando a revisão já foi emitida', () => {
      expect(() =>
        policy.assertCanAttachFile(manifest('ISSUED', 'file', true)),
      ).toThrow(/Only a draft revision/);
    });

    it('recusa quando o rascunho já tem arquivo', () => {
      expect(() =>
        policy.assertCanAttachFile(manifest('DRAFT', 'file')),
      ).toThrow(/already has a file/);
    });
  });

  describe('revogação', () => {
    it('revoga uma revisão emitida', () => {
      expect(() =>
        policy.assertCanRevoke(manifest('ISSUED', 'file', true)),
      ).not.toThrow();
    });

    it('revoga uma revisão já substituída', () => {
      expect(() =>
        policy.assertCanRevoke(manifest('SUPERSEDED', 'file')),
      ).not.toThrow();
    });

    it('não revoga duas vezes', () => {
      expect(() => policy.assertCanRevoke(manifest('REVOKED', 'file'))).toThrow(
        /already revoked/,
      );
    });

    it('rascunho se descarta, não se revoga', () => {
      expect(() => policy.assertCanRevoke(manifest('DRAFT'))).toThrow(
        /discarded, not revoked/,
      );
    });
  });

  describe('download', () => {
    it('permite baixar uma revisão emitida', () => {
      expect(() =>
        policy.assertCanDownload(manifest('ISSUED', 'file', true)),
      ).not.toThrow();
    });

    it('permite baixar uma revisão substituída — é histórico válido', () => {
      expect(() =>
        policy.assertCanDownload(manifest('SUPERSEDED', 'file')),
      ).not.toThrow();
    });

    it('recusa quando não há documento emitido', () => {
      expect(() => policy.assertCanDownload(manifest('DRAFT'))).toThrow(
        /no issued document/,
      );
    });

    it('recusa distribuir documento revogado', () => {
      expect(() =>
        policy.assertCanDownload(manifest('REVOKED', 'file')),
      ).toThrow(/no longer distributable/);
    });
  });
});
