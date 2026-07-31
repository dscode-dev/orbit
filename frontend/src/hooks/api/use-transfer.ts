"use client";

/**
 * Upload e download com estado de React.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  download,
  saveBlob,
  uploadWithProgress,
  type DownloadResult,
  type UploadOptions,
  type UploadProgress,
} from "@/api/transfer";
import { ApiError, toApiError } from "@/lib/api-error";
import type { QueryKey } from "@/api/query-keys";
import { useQueryClient } from "@tanstack/react-query";

export interface UseUploadOptions extends UploadOptions {
  /** Keys invalidadas após o envio (ex.: anexos da operação). */
  invalidate?: readonly QueryKey[];
}

export interface UseUploadResult<TData> {
  upload: (file: File | Blob) => Promise<TData>;
  cancel: () => void;
  progress: UploadProgress | null;
  isUploading: boolean;
  error: ApiError | null;
  data: TData | null;
}

/** Envia um arquivo para `path`, com progresso e cancelamento. */
export function useUpload<TData>(
  path: string,
  options: UseUploadOptions = {},
): UseUploadResult<TData> {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  /** Evita recriar `upload` quando as opções vêm inline do componente. */
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(
    async (file: File | Blob): Promise<TData> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setUploading(true);
      setError(null);
      setProgress(null);
      const current = optionsRef.current;
      try {
        const result = await uploadWithProgress<TData>(path, file, {
          ...current,
          signal: controller.signal,
          onProgress: setProgress,
        });
        setData(result);
        await Promise.all(
          (current.invalidate ?? []).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
        return result;
      } catch (cause) {
        const apiError = toApiError(cause);
        setError(apiError);
        throw apiError;
      } finally {
        setUploading(false);
        controllerRef.current = null;
      }
    },
    [path, queryClient],
  );

  return { upload: run, cancel, progress, isUploading, error, data };
}

export interface UseDownloadResult {
  download: (path: string, fileName?: string) => Promise<DownloadResult>;
  isDownloading: boolean;
  error: ApiError | null;
}

/** Baixa um binário do backend e salva no dispositivo. */
export function useDownload(): UseDownloadResult {
  const [isDownloading, setDownloading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (path: string, fileName?: string): Promise<DownloadResult> => {
      setDownloading(true);
      setError(null);
      try {
        const result = await download(path);
        saveBlob(result, fileName);
        return result;
      } catch (cause) {
        const apiError = toApiError(cause);
        setError(apiError);
        throw apiError;
      } finally {
        setDownloading(false);
      }
    },
    [],
  );

  return { download: run, isDownloading, error };
}
