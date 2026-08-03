/**
 * Critério de correção da assinatura.
 *
 * Estes testes fixam o que é **verificável sem servidor**: o `canonical
 * request` e o `string to sign` construídos exatamente como a especificação
 * SigV4 descreve, e as propriedades que a assinatura precisa ter (mudar o
 * segredo muda a assinatura; a codificação segue a regra da AWS).
 *
 * A prova de que um servidor S3 **aceita** estas URLs não cabe em teste
 * unitário — está no round-trip contra MinIO registrado em
 * `docs/artifact-storage.md`. Fixar aqui uma assinatura constante só provaria
 * que o código continua igual a si mesmo.
 */
import { awsUriEncode, presignS3Url } from './aws-signature-v4';

/** Credencial de exemplo da própria documentação da AWS. */
const AWS_EXAMPLE = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  bucket: 'examplebucket',
  objectKey: 'test.txt',
  signedAt: new Date('2013-05-24T00:00:00Z'),
};

describe('presignS3Url', () => {
  it('constrói o canonical request do exemplo oficial da AWS', () => {
    const result = presignS3Url({
      method: 'GET',
      endpoint: 'https://s3.amazonaws.com',
      region: AWS_EXAMPLE.region,
      accessKeyId: AWS_EXAMPLE.accessKeyId,
      secretAccessKey: AWS_EXAMPLE.secretAccessKey,
      bucket: AWS_EXAMPLE.bucket,
      objectKey: AWS_EXAMPLE.objectKey,
      expiresInSeconds: 86400,
      forcePathStyle: false,
      signedAt: AWS_EXAMPLE.signedAt,
    });

    /** O canonical request do exemplo "GET Object" da especificação. */
    expect(result.canonicalRequest).toBe(
      [
        'GET',
        '/test.txt',
        'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host',
        'host:examplebucket.s3.amazonaws.com\n',
        'host',
        'UNSIGNED-PAYLOAD',
      ].join('\n'),
    );

    const [algorithm, date, scope] = result.stringToSign.split('\n');
    expect(algorithm).toBe('AWS4-HMAC-SHA256');
    expect(date).toBe('20130524T000000Z');
    expect(scope).toBe('20130524/us-east-1/s3/aws4_request');
    expect(result.url).toMatch(/X-Amz-Signature=[a-f0-9]{64}$/);
  });

  it('endereça por subdomínio ou por caminho, conforme o provider', () => {
    const common = {
      method: 'GET' as const,
      endpoint: 'https://storage.local:9000',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'orbit',
      objectKey: 'org/manifests/file.pdf',
      expiresInSeconds: 300,
      signedAt: new Date('2026-08-03T12:00:00Z'),
    };

    const path = presignS3Url({ ...common, forcePathStyle: true });
    const subdomain = presignS3Url({ ...common, forcePathStyle: false });

    expect(path.url).toContain(
      'storage.local:9000/orbit/org/manifests/file.pdf',
    );
    expect(subdomain.url).toContain(
      'orbit.storage.local:9000/org/manifests/file.pdf',
    );
  });

  it('assina os parâmetros extras junto da URL', () => {
    const signed = presignS3Url({
      method: 'GET',
      endpoint: 'https://s3.amazonaws.com',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'orbit',
      objectKey: 'a.pdf',
      expiresInSeconds: 300,
      forcePathStyle: false,
      query: { 'response-content-disposition': 'attachment; filename="a.pdf"' },
      signedAt: new Date('2026-08-03T12:00:00Z'),
    });

    expect(signed.canonicalRequest).toContain('response-content-disposition');
    expect(signed.url).toContain('response-content-disposition');
  });

  it('muda a assinatura quando o segredo muda', () => {
    const build = (secret: string) =>
      presignS3Url({
        method: 'GET',
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        accessKeyId: 'key',
        secretAccessKey: secret,
        bucket: 'orbit',
        objectKey: 'a.pdf',
        expiresInSeconds: 300,
        forcePathStyle: false,
        signedAt: new Date('2026-08-03T12:00:00Z'),
      }).url;

    expect(build('secret-a')).not.toBe(build('secret-b'));
  });

  it('codifica o que a AWS exige e preserva a barra no caminho', () => {
    expect(awsUriEncode("a b!'()*c")).toBe('a%20b%21%27%28%29%2Ac');
    expect(awsUriEncode('org/file.pdf', true)).toBe('org/file.pdf');
    expect(awsUriEncode('org/file.pdf')).toBe('org%2Ffile.pdf');
  });
});
