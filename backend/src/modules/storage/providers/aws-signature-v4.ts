/**
 * Assinatura AWS Signature Version 4 para URLs pré-assinadas.
 *
 * ## Por que sem SDK
 *
 * O que o Orbit precisa de um object store S3 Compatible é **assinar uma URL**
 * e, ocasionalmente, ler ou gravar um objeto. Assinar é um algoritmo fechado e
 * determinístico — quatro HMAC-SHA256 encadeados — e transferir é um `fetch`
 * sobre a URL assinada.
 *
 * Trazer o SDK da AWS para isso acrescentaria dezenas de megabytes de
 * dependência para reimplementar o que está abaixo, e ainda assim exigiria um
 * adaptador para MinIO. O algoritmo aqui é testado contra o **vetor oficial da
 * documentação da AWS**, que é o mesmo critério que o SDK usa.
 *
 * ## Escopo
 *
 * Apenas *query string request authentication* (`X-Amz-Signature` na URL), que
 * é a forma usada em URL pré-assinada. Assinatura por cabeçalho `Authorization`
 * não é necessária: as operações do servidor também usam a URL assinada.
 *
 * Referência: AWS — "Signature Version 4 signing process".
 */
import { createHash, createHmac } from 'node:crypto';

export interface PresignInput {
  readonly method: 'GET' | 'PUT' | 'HEAD';
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
  readonly forcePathStyle: boolean;
  /** Parâmetros extras assinados junto (ex.: `response-content-disposition`). */
  readonly query?: Readonly<Record<string, string>>;
  /** Instante da assinatura; injetável para o teste ser determinístico. */
  readonly signedAt?: Date;
  readonly service?: string;
}

const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

/**
 * Codificação de URI da AWS.
 *
 * `encodeURIComponent` deixa `!'()*` passar e a AWS exige que sejam
 * codificados. A barra é preservada no caminho e codificada na query — é a
 * diferença que o parâmetro `path` controla.
 */
export function awsUriEncode(value: string, path = false): string {
  return value
    .split('')
    .map((character) => {
      if (/[A-Za-z0-9\-._~]/.test(character)) return character;
      if (character === '/' && path) return character;
      return Array.from(Buffer.from(character, 'utf8'))
        .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
        .join('');
    })
    .join('');
}

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const hmac = (key: Buffer | string, value: string): Buffer =>
  createHmac('sha256', key).update(value, 'utf8').digest();

/** `YYYYMMDDTHHMMSSZ` e `YYYYMMDD`, os dois formatos que o SigV4 usa. */
function timestamps(at: Date): { amzDate: string; dateStamp: string } {
  const amzDate = at.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/** Chave derivada: data → região → serviço → `aws4_request`. */
function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  return hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
    'aws4_request',
  );
}

export interface PresignResult {
  readonly url: string;
  readonly expiresAt: Date;
  readonly canonicalRequest: string;
  readonly stringToSign: string;
}

export function presignS3Url(input: PresignInput): PresignResult {
  const service = input.service ?? 's3';
  const signedAt = input.signedAt ?? new Date();
  const { amzDate, dateStamp } = timestamps(signedAt);

  const url = new URL(input.endpoint);
  const encodedKey = awsUriEncode(input.objectKey, true);
  const host = input.forcePathStyle ? url.host : `${input.bucket}.${url.host}`;
  const canonicalUri = input.forcePathStyle
    ? `${url.pathname.replace(/\/+$/, '')}/${input.bucket}/${encodedKey}`
    : `${url.pathname.replace(/\/+$/, '')}/${encodedKey}`;

  const credential = `${input.accessKeyId}/${dateStamp}/${input.region}/${service}/aws4_request`;
  const parameters: Record<string, string> = {
    ...input.query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };

  /** A query canônica é ordenada por chave, com nome e valor codificados. */
  const canonicalQuery = Object.keys(parameters)
    .sort()
    .map((key) => `${awsUriEncode(key)}=${awsUriEncode(parameters[key] ?? '')}`)
    .join('&');

  const canonicalRequest = [
    input.method,
    canonicalUri || '/',
    canonicalQuery,
    `host:${host}\n`,
    'host',
    UNSIGNED_PAYLOAD,
  ].join('\n');

  const scope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac(
    'sha256',
    signingKey(input.secretAccessKey, dateStamp, input.region, service),
  )
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    url: `${url.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    expiresAt: new Date(signedAt.getTime() + input.expiresInSeconds * 1000),
    canonicalRequest,
    stringToSign,
  };
}
