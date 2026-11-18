"use client";
import { useEffect, useRef, useState } from "react";
import type { SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { SchoolPoint } from "./settings-values";

const SEARCH_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 3;

export type SchoolAddressSearch = {
  query: string;
  selected: SearchSelectOption | null;
  options: SearchSelectOption[];
  loading: boolean;
  failed: boolean;
  resolving: boolean;
  error: string;
  select: (option: SearchSelectOption) => Promise<void>;
  change: (value: string) => void;
  clear: () => void;
};

function useDebouncedAddress(query: string): string {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  return debounced;
}

function queryState(query: string, delayed: string): { enabled: boolean; waiting: boolean } {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return { enabled: false, waiting: false };
  return { enabled: trimmed === delayed, waiting: trimmed !== delayed };
}

export function useSchoolAddressSearch(input: {
  label: string;
  onSelect: (point: SchoolPoint, label: string) => void;
  onClear: () => void;
}): SchoolAddressSearch {
  const [query, setQuery] = useState(input.label);
  const debounced = useDebouncedAddress(query);
  const [selected, setSelected] = useState<SearchSelectOption | null>(
    input.label ? { id: "saved", label: input.label } : null,
  );
  const [error, setError] = useState("");
  const revision = useRef(0);
  const resolve = trpc.addresses.location.useMutation();
  useEffect(() => {
    setQuery(input.label);
    setSelected(input.label ? { id: "saved", label: input.label } : null);
  }, [input.label]);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );
  const { enabled, waiting } =
    selected === null ? queryState(query, debounced) : { enabled: false, waiting: false };
  const search = trpc.addresses.search.useQuery(
    { query: debounced },
    { enabled, retry: false, gcTime: 0, refetchOnWindowFocus: false },
  );
  async function select(option: SearchSelectOption): Promise<void> {
    const request = ++revision.current;
    setError("");
    setSelected(option);
    setQuery(option.label);
    try {
      const value = await resolve.mutateAsync({ placeId: option.id });
      if (revision.current !== request) return;
      setSelected({ id: option.id, label: value.label });
      setQuery(value.label);
      input.onSelect(value, value.label);
    } catch {
      if (revision.current === request) {
        setSelected(null);
        setError(
          "Não foi possível localizar esse endereço. Tente outro resultado ou marque o ponto no mapa.",
        );
      }
    }
  }
  return {
    query,
    selected,
    options: enabled ? (search.data ?? []) : [],
    loading: waiting || (enabled && search.isFetching),
    failed: enabled && search.isError,
    resolving: resolve.isPending,
    error,
    select,
    change: (value: string): void => {
      revision.current += 1;
      setQuery(value);
      setSelected(null);
      setError("");
    },
    clear: (): void => {
      revision.current += 1;
      setQuery("");
      setSelected(null);
      setError("");
      input.onClear();
    },
  };
}
