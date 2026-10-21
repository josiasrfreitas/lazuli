"use client";

import { useEffect, useState } from "react";
import { normalizeSearch } from "@lazuli/domain";
import { trpc } from "~/lib/trpc";

const SEARCH_DEBOUNCE_MS = 180;

export function useCommandSearch(query: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);
  const searchable = enabled && normalizeSearch(query).length >= 2;
  const result = trpc.commandSearch.lookup.useQuery(
    { query: debounced },
    {
      enabled: searchable && query === debounced,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );
  return {
    data: searchable && query === debounced ? result.data : undefined,
    pending: searchable && (query !== debounced || result.isFetching),
    error: searchable && query === debounced && result.isError,
    retry: () => {
      void result.refetch();
    },
  };
}
