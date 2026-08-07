"use client";

/**
 * Estado de uma listagem — busca, filtros e página.
 *
 * Seis listagens escreveram o mesmo bloco: um `useState` para o termo digitado,
 * um `useEffect` com `setTimeout` de 400 ms, um segundo estado para o termo que
 * de fato viaja, e a lembrança de voltar para a página 1 sempre que um filtro
 * muda. Seis chances de esquecer a última parte — e o sintoma é sutil: filtrar
 * na página 3 devolve uma página vazia.
 *
 * ```ts
 * const list = useListController<AssetQuery>({ limit: 20 });
 *
 * list.searchTerm;              // o que está no campo, a cada tecla
 * list.query;                   // { page, limit, search, …filtros }
 * list.setFilter("status", v);  // volta para a página 1 sozinho
 * ```
 *
 * ## O que ele não faz
 *
 * Não conhece endpoint, não busca nada e não sabe que filtros existem — quem
 * declara é a tela, e quem valida é o backend. É estado de interface, só isso.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

/** Espera antes de a busca viajar. Uma tecla não é uma requisição. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Valor de "sem filtro" nos seletores.
 *
 * O Radix Select não aceita `value=""` (string vazia é como ele representa
 * "nada selecionado"), então a opção "Todos" precisa de um valor real. Esta
 * sentinela nunca sai do cliente: vira `undefined` antes de virar query.
 */
export const ANY_OPTION = "__all__";

/** `undefined` quando o valor é a sentinela — pronto para virar query. */
export function fromAnyOption(value: string): string | undefined {
  return value === ANY_OPTION ? undefined : value;
}

/** A sentinela quando não há valor — pronto para alimentar um `Select`. */
export function toAnyOption(value: string | undefined | null): string {
  return value ?? ANY_OPTION;
}

/** Filtros que qualquer listagem tem. O resto é de cada tela. */
export interface BaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListControllerOptions<TQuery extends BaseListQuery> {
  readonly limit?: number;
  /** Filtros iniciais além de página e limite. */
  readonly initial?: Omit<TQuery, "page" | "limit" | "search">;
  readonly debounceMs?: number;
}

export interface ListController<TQuery extends BaseListQuery> {
  /** O que está no campo agora — reflete cada tecla. */
  readonly searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** A consulta pronta para o serviço, com a busca já estabilizada. */
  readonly query: TQuery;
  /** Muda um filtro e volta para a primeira página. */
  setFilter: <TKey extends keyof TQuery>(key: TKey, value: TQuery[TKey]) => void;
  /** Muda vários filtros de uma vez e volta para a primeira página. */
  patch: (next: Partial<TQuery>) => void;
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  reset: () => void;
  /** `true` quando há busca ou algum filtro além de página e limite. */
  readonly isFiltered: boolean;
}

export function useListController<TQuery extends BaseListQuery>(
  options: ListControllerOptions<TQuery> = {},
): ListController<TQuery> {
  const { limit = 20, initial, debounceMs = SEARCH_DEBOUNCE_MS } = options;

  /**
   * `initial` costuma ser um literal inline, e um literal muda de identidade a
   * cada render. Congelado na montagem: os filtros de partida são de partida.
   */
  const [initialFilters] = useState(() => initial ?? {});

  const [searchTerm, setSearchTerm] = useState("");
  const [state, setState] = useState<TQuery>(
    () => ({ ...initialFilters, page: 1, limit }) as TQuery,
  );

  /** A busca só viaja depois que a digitação para. */
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = searchTerm.trim() || undefined;
      setState((current) =>
        current.search === search ? current : { ...current, search, page: 1 },
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  const patch = useCallback((next: Partial<TQuery>) => {
    setState((current) => ({ ...current, ...next, page: 1 }));
  }, []);

  const setFilter = useCallback(
    <TKey extends keyof TQuery>(key: TKey, value: TQuery[TKey]) => {
      setState((current) => ({ ...current, [key]: value, page: 1 }));
    },
    [],
  );

  const setPage = useCallback((page: number) => {
    setState((current) => ({ ...current, page: Math.max(1, page) }));
  }, []);

  const nextPage = useCallback(() => {
    setState((current) => ({ ...current, page: (current.page ?? 1) + 1 }));
  }, []);

  const previousPage = useCallback(() => {
    setState((current) => ({
      ...current,
      page: Math.max(1, (current.page ?? 1) - 1),
    }));
  }, []);

  const reset = useCallback(() => {
    setSearchTerm("");
    setState({ ...initialFilters, page: 1, limit } as TQuery);
  }, [initialFilters, limit]);

  const isFiltered = useMemo(() => {
    return Object.entries(state).some(([key, value]) => {
      if (key === "page" || key === "limit") return false;
      return value !== undefined && value !== null && value !== "";
    });
  }, [state]);

  return {
    searchTerm,
    setSearchTerm,
    query: state,
    setFilter,
    patch,
    setPage,
    nextPage,
    previousPage,
    reset,
    isFiltered,
  };
}
