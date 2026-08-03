/**
 * Provider S3 Compatible — serve AWS S3 e MinIO com o mesmo código.
 *
 * MinIO implementa o protocolo S3; a única diferença prática é o endereçamento
 * por caminho (`https://host/bucket/key`) em vez de subdomínio, e isso é uma
 * bandeira de configuração.
 *
 * ## Transferência pela própria URL assinada
 *
 * `put`, `get` e `head` assinam a URL e usam `fetch`. Não há caminho de acesso
 * privilegiado paralelo: **a mesma assinatura que o cliente usaria** é a que o
 * servidor usa. Um erro de política de bucket aparece no primeiro teste, não
 * em produção quando o primeiro cliente tentar baixar.
 */
import { Injectable } from '@nestjs/common';
import { InfrastructureException } from '../../../exceptions';
import type { S3Config } from '../storage.config';
import { presignS3Url } from './aws-signature-v4';
import type {
  ObjectStat,
  PutObjectInput,
  SignedUrl,
  SignedUrlRequest,
  StorageObjectRef,
  StorageProvider,
  StorageProviderName,
} from '../storage.types';

@Injectable()
export class S3CompatibleStorageProvider implements StorageProvider {
  constructor(
    readonly name: StorageProviderName,
    readonly defaultBucket: string,
    private readonly config: S3Config,
  ) {}

  /**
   * Gravação pela URL assinada.
   *
   * **Sem cabeçalhos `x-amz-meta-*`.** A assinatura cobre apenas `host`
   * (`X-Amz-SignedHeaders=host`), e um `x-amz-*` que não entrou na assinatura
   * é recusado com 400 — verificado contra o MinIO. Os metadados que
   * interessam (organização, hash, vínculos) já vivem em `storage_files`, que
   * é onde a plataforma os consulta; duplicá-los no objeto acrescentaria
   * acoplamento ao provider sem nenhum uso.
   */
  async put(input: PutObjectInput): Promise<ObjectStat> {
    const signed = this.presign('PUT', input, 300);
    const response = await fetch(signed.url, {
      method: 'PUT',
      body: new Uint8Array(input.body),
      headers: { 'content-type': input.mimeType },
    });
    if (!response.ok) {
      throw new InfrastructureException(
        `Storage rejected the object upload (${response.status})`,
      );
    }
    return {
      bucket: input.bucket,
      objectKey: input.objectKey,
      sizeBytes: input.body.length,
      mimeType: input.mimeType,
    };
  }

  async get(ref: StorageObjectRef): Promise<Buffer> {
    const signed = this.presign('GET', ref, 60);
    const response = await fetch(signed.url);
    if (!response.ok) {
      throw new InfrastructureException(
        `Storage object is unavailable (${response.status})`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * O método faz parte da assinatura.
   *
   * Assinar como `GET` e requisitar `HEAD` devolve 403 — verificado. A
   * assinatura é feita para o método que será usado.
   */
  async head(ref: StorageObjectRef): Promise<ObjectStat | null> {
    const signed = this.presign('HEAD', ref, 60);
    const response = await fetch(signed.url, { method: 'HEAD' });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new InfrastructureException(
        `Storage metadata is unavailable (${response.status})`,
      );
    }
    return {
      ...ref,
      sizeBytes: Number(response.headers.get('content-length') ?? 0),
      mimeType: response.headers.get('content-type'),
    };
  }

  /**
   * Remoção.
   *
   * `DELETE` não é assinado por este módulo de propósito: apagar objeto é
   * operação de ciclo de vida do bucket, e um documento emitido não deve
   * desaparecer do storage por ação da aplicação. O manifest revoga; o objeto
   * permanece para auditoria.
   */
  remove(ref: StorageObjectRef): Promise<void> {
    void ref;
    return Promise.reject(
      new InfrastructureException(
        'Removing objects is not supported: issued documents are retained for audit',
      ),
    );
  }

  sign(request: SignedUrlRequest): Promise<SignedUrl> {
    const method = request.operation === 'upload' ? 'PUT' : 'GET';
    const query: Record<string, string> = {};

    /**
     * `download` força salvar; `preview` deixa o navegador abrir. É a única
     * diferença entre as duas operações — o objeto é o mesmo.
     */
    if (request.operation === 'download' && request.fileName) {
      query['response-content-disposition'] =
        `attachment; filename="${request.fileName.replace(/"/g, '')}"`;
    }
    if (request.operation === 'preview') {
      query['response-content-disposition'] = 'inline';
    }
    if (request.mimeType && request.operation !== 'upload') {
      query['response-content-type'] = request.mimeType;
    }

    const signed = this.presign(
      method,
      request,
      request.expiresInSeconds,
      query,
    );

    return Promise.resolve({
      url: signed.url,
      expiresAt: signed.expiresAt,
      method,
      requiredHeaders: this.uploadHeaders(request),
    });
  }

  /** O `content-type` do PUT entra na assinatura; o cliente precisa repeti-lo. */
  private uploadHeaders(
    request: SignedUrlRequest,
  ): Readonly<Record<string, string>> {
    return request.operation === 'upload' && request.mimeType
      ? { 'content-type': request.mimeType }
      : {};
  }

  private presign(
    method: 'GET' | 'PUT' | 'HEAD',
    ref: StorageObjectRef,
    expiresInSeconds: number,
    query?: Record<string, string>,
  ) {
    return presignS3Url({
      method,
      endpoint: this.config.endpoint,
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      bucket: ref.bucket,
      objectKey: ref.objectKey,
      expiresInSeconds,
      forcePathStyle: this.config.forcePathStyle,
      query,
    });
  }
}
