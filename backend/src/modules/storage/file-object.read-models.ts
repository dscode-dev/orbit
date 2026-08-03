/**
 * Contrato público de um arquivo.
 *
 * **`bucket` e `objectKey` não estão aqui, e não devem estar.** Publicá-los
 * daria ao cliente um endereço interno do provider — que muda ao trocar de
 * provider, que não é autorizável, e que convida a tentar acesso direto ao
 * object store. O que o cliente recebe é a identidade do arquivo, o que
 * precisa para exibi-lo e o hash que prova o conteúdo.
 *
 * O acesso acontece por URL assinada, emitida sob autorização.
 */

export const STORAGE_FILE_STATUSES = [
  'PENDING',
  'AVAILABLE',
  'MISSING',
] as const;
export type StorageFileStatus = (typeof STORAGE_FILE_STATUSES)[number];

export interface StorageFileReadModel {
  id: string;
  fileName: string;
  mimeType: string;
  /** Em bytes; serializado como texto porque `BigInt` não cabe em JSON. */
  sizeBytes: string;
  /** SHA-256 do conteúdo; nulo enquanto o upload não foi confirmado. */
  sha256: string | null;
  status: StorageFileStatus;
  /** Nome do provider — informativo. Não permite endereçar o objeto. */
  provider: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

/**
 * URL temporária de acesso a um objeto.
 *
 * `expiresAt` é publicado para o cliente saber quando pedir outra, em vez de
 * descobrir por uma falha.
 */
export interface SignedUrlReadModel {
  url: string;
  method: 'GET' | 'PUT';
  expiresAt: string;
  /** Cabeçalhos obrigatórios para a assinatura valer. */
  requiredHeaders: Readonly<Record<string, string>>;
}
