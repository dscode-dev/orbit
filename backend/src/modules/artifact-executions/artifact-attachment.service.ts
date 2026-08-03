/**
 * Anexos da execução sobre o Storage (Stage 7).
 *
 * ## O que muda e o que não muda
 *
 * **Não muda nenhum contrato existente.** `POST /artifact-executions/:id/attachments`
 * continua recebendo exatamente os mesmos campos, e o Read Model do anexo
 * continua publicando `storageKey`. Web e Flutter não precisam de uma linha.
 *
 * **Muda a infraestrutura por baixo**: o anexo passa a ter um `StorageFile`
 * correspondente, com provider, bucket e chave gerenciados pela plataforma. É
 * o que permite assiná-lo para download sem cada módulo reimplementar acesso a
 * arquivo.
 *
 * ## A lacuna que este serviço fecha
 *
 * Até aqui o anexo era **só metadado**: o cliente informava `storageKey`,
 * `sizeBytes` e `checksum` de um arquivo que a plataforma nunca recebeu. Não
 * havia caminho de upload — o registro apontava para um objeto que não
 * existia em lugar nenhum.
 *
 * As duas rotas novas são **aditivas** e fecham o ciclo: uma reserva o objeto
 * e devolve URL de upload; a outra devolve URL de download. Quem já integrou
 * com o contrato antigo continua funcionando; quem quiser enviar o binário
 * agora tem por onde.
 */
import { Injectable } from '@nestjs/common';
import { ConflictException, EntityNotFoundException } from '../../exceptions';
import {
  FileObjectService,
  STORAGE_NAMESPACES,
} from '../storage/file-object.service';
import { StorageFileMapper } from '../storage/file-object.mapper';
import type { SignedUrlReadModel } from '../storage/file-object.read-models';
import { ArtifactExecutionRepository } from './artifact-execution.repository';
import type { ReserveArtifactAttachmentDto } from './dto/artifact-attachment.dto';

export interface AttachmentActor {
  organizationId: string;
  actorId: string;
}

@Injectable()
export class ArtifactAttachmentService {
  constructor(
    private readonly executions: ArtifactExecutionRepository,
    private readonly files: FileObjectService,
    private readonly mapper: StorageFileMapper,
  ) {}

  /**
   * Reserva o objeto e devolve a URL de upload.
   *
   * A `storageKey` a ser informada no registro do anexo vem daqui: é o
   * identificador do arquivo reservado, não um nome escolhido pelo cliente.
   */
  async reserveUpload(
    executionId: string,
    { organizationId, actorId }: AttachmentActor,
    input: ReserveArtifactAttachmentDto,
  ): Promise<{
    fileId: string;
    storageKey: string;
    upload: SignedUrlReadModel;
  }> {
    const execution = await this.execution(executionId, organizationId);

    const { file, signed } = await this.files.reserve({
      organizationId,
      businessUnitId: execution.businessUnitId,
      namespace: STORAGE_NAMESPACES.attachment,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      metadata: { executionId },
      createdById: actorId,
    });

    return {
      fileId: file.id,
      /**
       * O identificador do arquivo é o que o cliente informa como
       * `storageKey` ao registrar o anexo. Continua sendo um texto opaco para
       * ele — e agora é um texto que a plataforma reconhece.
       */
      storageKey: file.id,
      upload: this.mapper.signedUrl(signed),
    };
  }

  /** URL assinada de leitura de um anexo já registrado (Stage 8). */
  async signDownload(
    executionId: string,
    attachmentId: string,
    { organizationId }: AttachmentActor,
    operation: 'download' | 'preview',
  ): Promise<SignedUrlReadModel> {
    const execution = await this.execution(executionId, organizationId);
    const attachment = execution.attachments.find(
      (item) => item.id === attachmentId,
    );
    if (!attachment) {
      throw new EntityNotFoundException(
        'Artifact execution attachment',
        attachmentId,
      );
    }

    /**
     * Anexo anterior à PR-19.
     *
     * `fileId` nulo significa que o registro nunca correspondeu a um objeto —
     * é o estado herdado, não um erro do usuário. A recusa diz exatamente
     * isso, em vez de devolver uma URL que daria 404.
     */
    if (!attachment.fileId) {
      throw new ConflictException(
        'This attachment predates managed storage and has no stored object',
      );
    }

    const file = await this.files.confirmRegistered(
      attachment.fileId,
      organizationId,
    );

    const signed = await this.files.sign(
      {
        bucket: file.bucket,
        objectKey: file.objectKey,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      },
      operation,
    );

    return this.mapper.signedUrl(signed);
  }

  private async execution(id: string, organizationId: string) {
    const execution = await this.executions.find(id, organizationId);
    if (!execution) {
      throw new EntityNotFoundException('Artifact execution', id);
    }
    return execution;
  }
}
