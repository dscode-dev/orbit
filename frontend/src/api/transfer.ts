/**
 * Upload e download.
 *
 * O backend recebe uploads como `multipart/form-data` no campo `file`
 * (`FileInterceptor('file')`, limite de 20 MB) e devolve downloads como corpo
 * binário com `Content-Disposition`.
 */
import { ApiError } from "@/lib/api-error";
import { DEFAULT_UPLOAD_TIMEOUT_MS, MAX_UPLOAD_BYTES } from "@/lib/env";
import type { RequestOptions } from "@/types/api";
import { parseContentDisposition } from "@/utils/http";
import { apiClient } from "./client";
import { httpRequest, readEnvelope } from "./http";
import { resolveRequestContext } from "./request-context";
import { CONTEXT_HEADERS } from "@/lib/context-headers";
import { BFF_BASE_PATH } from "@/lib/env";
import { normalizePath, serializeQuery } from "@/utils/http";

export interface UploadOptions extends RequestOptions {
  /** Nome do campo do arquivo. Padrão: `file` (contrato do backend). */
  fieldName?: string;
  /** Campos adicionais do formulário. */
  fields?: Readonly<Record<string, string>>;
}

export interface DownloadResult {
  blob: Blob;
  fileName: string;
  contentType: string;
  /** Presente nos PDFs assinados (`X-Document-SHA256`). */
  sha256: string | null;
}

function assertSize(file: File | Blob): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError({
      kind: "http",
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: `Arquivo acima do limite de ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    });
  }
}

function buildFormData(file: File | Blob, options: UploadOptions): FormData {
  const form = new FormData();
  const name = file instanceof File ? file.name : "arquivo";
  form.append(options.fieldName ?? "file", file, name);
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    form.append(key, value);
  }
  return form;
}

/** Envia um arquivo. Sem progresso — use `uploadWithProgress` quando precisar. */
export async function upload<T>(
  path: string,
  file: File | Blob,
  options: UploadOptions = {},
): Promise<T> {
  assertSize(file);
  return apiClient.post<T>(path, buildFormData(file, options), {
    ...options,
    timeoutMs: options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
    retries: 0,
  });
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Upload com progresso.
 *
 * `fetch` não expõe progresso de envio, então este caminho usa
 * `XMLHttpRequest` — nativo do browser, sem dependências adicionais. O
 * contrato (rota, envelope, erros e cancelamento) é idêntico ao de `upload`.
 */
export function uploadWithProgress<T>(
  path: string,
  file: File | Blob,
  options: UploadOptions & {
    onProgress?: (progress: UploadProgress) => void;
  } = {},
): Promise<T> {
  assertSize(file);
  const context = resolveRequestContext(options.context);
  const url = `${BFF_BASE_PATH}${normalizePath(path)}${serializeQuery(options.query)}`;

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.responseType = "text";
    request.timeout = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
    request.setRequestHeader("accept", "application/json");
    request.setRequestHeader(CONTEXT_HEADERS.requestId, context.requestId);
    request.setRequestHeader(CONTEXT_HEADERS.timezone, context.timezone);
    if (context.organizationId) {
      request.setRequestHeader(
        CONTEXT_HEADERS.organizationId,
        context.organizationId,
      );
    }
    if (context.businessUnitId) {
      request.setRequestHeader(
        CONTEXT_HEADERS.businessUnitId,
        context.businessUnitId,
      );
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      request.setRequestHeader(name, value);
    }

    const fail = (error: ApiError): void => {
      options.signal?.removeEventListener("abort", onAbort);
      reject(error);
    };
    const onAbort = (): void => {
      request.abort();
      fail(new ApiError({ kind: "aborted", message: "Upload cancelado." }));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    request.upload.addEventListener("progress", (event) => {
      if (!options.onProgress || !event.lengthComputable) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    });
    request.addEventListener("error", () =>
      fail(
        new ApiError({
          kind: "network",
          message: "Falha de conexão durante o upload.",
        }),
      ),
    );
    request.addEventListener("timeout", () =>
      fail(
        new ApiError({
          kind: "timeout",
          message: "O upload excedeu o tempo limite.",
        }),
      ),
    );
    request.addEventListener("load", () => {
      options.signal?.removeEventListener("abort", onAbort);
      const body = new Response(request.responseText, {
        status: request.status,
        headers: {
          "content-type":
            request.getResponseHeader("content-type") ?? "application/json",
          [CONTEXT_HEADERS.requestId]:
            request.getResponseHeader(CONTEXT_HEADERS.requestId) ??
            context.requestId,
        },
      });
      readEnvelope<T>(body).then(resolve, reject);
    });

    request.send(buildFormData(file, options));
  });
}

/** Baixa um recurso binário e devolve o blob com os metadados da resposta. */
export async function download(
  path: string,
  options: RequestOptions = {},
): Promise<DownloadResult> {
  const response = await httpRequest({ method: "GET", path, ...options });
  if (!response.ok) {
    return readEnvelope<never>(response);
  }
  const blob = await response.blob();
  return {
    blob,
    fileName:
      parseContentDisposition(response.headers.get("content-disposition")) ??
      "download",
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
    sha256: response.headers.get("x-document-sha256"),
  };
}

/** Dispara o salvamento do arquivo no browser. */
export function saveBlob(result: DownloadResult, fileName?: string): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName ?? result.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Baixa e salva em uma única chamada. */
export async function downloadAndSave(
  path: string,
  options?: RequestOptions & { fileName?: string },
): Promise<DownloadResult> {
  const result = await download(path, options);
  saveBlob(result, options?.fileName);
  return result;
}
