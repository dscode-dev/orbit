"use client";

/**
 * Hook de escrita.
 *
 * Sobre o `useMutation` padrão: erro tipado como `ApiError` e invalidação
 * declarativa das query keys afetadas — o padrão de escrita do Orbit é
 * "mutou, invalida", sem manipular cache manualmente.
 *
 * ```ts
 * const create = useApiMutation(
 *   (input: CreateOperationInput) => operationsService.create(input),
 *   { invalidate: [operationsService.keys.module()] },
 * );
 * ```
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { QueryKey } from "@/api/query-keys";
import type { ApiError } from "@/lib/api-error";

export interface ApiMutationOptions<
  TData,
  TVariables,
  TOnMutateResult = unknown,
> extends Omit<
  UseMutationOptions<TData, ApiError, TVariables, TOnMutateResult>,
  "mutationFn"
> {
  /** Keys invalidadas após o sucesso (prefixos são aceitos). */
  invalidate?: readonly QueryKey[];
}

export function useApiMutation<
  TData,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ApiMutationOptions<TData, TVariables, TOnMutateResult> = {},
): UseMutationResult<TData, ApiError, TVariables, TOnMutateResult> {
  const queryClient = useQueryClient();
  const { invalidate, onSuccess, ...rest } = options;

  return useMutation<TData, ApiError, TVariables, TOnMutateResult>({
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all(
        (invalidate ?? []).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}
