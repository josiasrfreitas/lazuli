"use client";
import { useEffect, useRef, useState } from "react";
import type { SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { SchoolPoint } from "./settings-values";

const SEARCH_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 3;

export function useSchoolAddressSearch(input: {
  label: string;
  onSelect: (point: SchoolPoint, label: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(input.label);
  const [debounced, setDebounced] = useState("");
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
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );
  const enabled =
    selected === null && debounced.length >= MIN_QUERY_LENGTH && query.trim() === debounced;
  const waiting =
    selected === null && query.trim().length >= MIN_QUERY_LENGTH && query.trim() !== debounced;
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
