/**
 * Frontend Core — camada de acesso à API no browser.
 *
 * Importe sempre daqui: `import { apiClient, queryKeys } from "@/api";`
 */
export { apiClient, authClient } from "./client";
export { httpJson, httpRequest, readEnvelope, type HttpRequest } from "./http";
export {
  download,
  downloadAndSave,
  saveBlob,
  upload,
  uploadWithProgress,
  type DownloadResult,
  type UploadOptions,
  type UploadProgress,
} from "./transfer";
export { queryKeys, ORBIT_QUERY_SCOPE, type QueryKey } from "./query-keys";
export {
  createQueryClient,
  getQueryClient,
  queryClientConfig,
} from "./query-client";
export {
  getAmbientContext,
  resolveRequestContext,
  setAmbientContext,
  type AmbientContext,
} from "./request-context";
export { ApiError, isApiError, toApiError } from "@/lib/api-error";
export { isRetryableError } from "@/lib/retry";
