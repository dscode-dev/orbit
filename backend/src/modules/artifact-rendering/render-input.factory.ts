/**
 * Monta o `RenderInput` a partir do que o banco devolveu.
 *
 * ## Por que isto saiu do processador
 *
 * A montagem — baixar evidência do storage, casar assinatura com imagem,
 * resolver o contexto do documento — vivia dentro do `try` do processador de
 * fila. Funcionava para o único caminho que existia: renderizar de verdade,
 * em segundo plano, gravando manifesto.
 *
 * O preview precisa exatamente disso e de nada do resto. Duplicar a montagem
 * garantiria que o que o owner vê e o que ele recebe divergissem na primeira
 * mudança — e divergiriam em silêncio, porque ninguém compara dois PDFs.
 *
 * Com o fabricante no meio, preview e emissão partem do **mesmo** input e do
 * mesmo renderer. A diferença entre eles é só o que acontece com os bytes.
 */
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.types';
import { ArtifactRenderAssembler } from './artifact-render.assembler';
import { DocumentContextBuilder } from './document-context.builder';
import type { RenderInput } from './renderers/artifact-renderer';

/** A linha que o repositório devolve, com os anexos já resolvidos. */
type RenderSource = NonNullable<
  Awaited<ReturnType<import('./artifact-render.repository').ArtifactRenderRepository['findRenderSource']>>
>;

@Injectable()
export class RenderInputFactory {
  constructor(
    private readonly assembler: ArtifactRenderAssembler,
    private readonly documentContext: DocumentContextBuilder,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async build(
    source: RenderSource,
    correlationId: string,
  ): Promise<RenderInput> {
    const evidence = await this.evidencia(source);
    const signatures = await this.assinaturas(source);
    const fieldAssets = await this.anexosDeCampo(source);

    const documentContext = this.documentContext.build({
      businessUnit: source.businessUnit,
      customer: source.customer,
      operation: source.operation,
      legalReference:
        source.snapshot.artifactType === 'PMOC'
          ? 'Plano de Manutenção, Operação e Controle — Lei nº 13.589/2018.'
          : undefined,
    });

    return source.fieldArtifact
      ? this.assembler.assembleFrozen({
          execution: source,
          snapshot: source.snapshot,
          frozen: source.fieldArtifact.snapshot,
          assets: fieldAssets,
          organizationName: source.organization.displayName,
          correlationId,
          documentContext,
        })
      : this.assembler.assemble({
          execution: source,
          snapshot: source.snapshot,
          responses: source.responses,
          signatures,
          evidence,
          organizationName: source.organization.displayName,
          correlationId,
          documentContext,
        });
  }

  private async evidencia(source: RenderSource) {
    const itens = [
      ...(source.pmocEquipmentExecution?.evidence ?? []).map((item) => ({
        id: item.id,
        kind: item.kind,
        caption: item.caption,
        fileName: item.storageFile.fileName,
        mimeType: item.storageFile.mimeType,
        sha256: item.storageFile.sha256,
        storageFile: item.storageFile,
      })),
      ...(source.pmocEquipmentExecution?.fieldEvidence ?? []).map((item) => ({
        id: item.id,
        kind: item.category,
        caption: null,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sha256: item.sha256,
        storageFile: item.storageFile,
      })),
    ];

    return Promise.all(
      itens.map(async (item) => ({
        id: item.id,
        kind: item.kind,
        caption: item.caption,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sha256: item.sha256,
        bytes:
          item.storageFile.status === 'AVAILABLE'
            ? await this.storage.get({
                bucket: item.storageFile.bucket,
                objectKey: item.storageFile.objectKey,
              })
            : undefined,
      })),
    );
  }

  private async assinaturas(source: RenderSource) {
    const imagens = new Map(
      await Promise.all(
        source.signatureAssets.map(
          async (asset) =>
            [
              asset.id,
              {
                bytes: await this.storage.get({
                  bucket: asset.bucket,
                  objectKey: asset.objectKey,
                }),
                mimeType: asset.mimeType,
              },
            ] as const,
        ),
      ),
    );

    return source.signatures.map((signature) => {
      const imagem = signature.signatureAssetId
        ? imagens.get(signature.signatureAssetId)
        : undefined;
      return {
        ...signature,
        signatureImage: imagem?.bytes,
        signatureImageMimeType: imagem?.mimeType,
      };
    });
  }

  private async anexosDeCampo(source: RenderSource) {
    return new Map(
      await Promise.all(
        source.fieldAssets.map(
          async (asset) =>
            [
              asset.id,
              {
                bytes: await this.storage.get({
                  bucket: asset.bucket,
                  objectKey: asset.objectKey,
                }),
                mimeType: asset.mimeType,
                fileName: asset.fileName,
              },
            ] as const,
        ),
      ),
    );
  }
}
