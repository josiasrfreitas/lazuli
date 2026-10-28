import type { RemoteOptionsResult, TableFilterOption } from "@lazuli/ui";

const VISIBLE_LIMIT = 20;
const API_LIMIT = 50;

export function studentFilterOptionResult(
  search: string,
  query: {
    data: TableFilterOption[] | undefined;
    isError: boolean;
    isFetching: boolean;
    refetch: () => void;
  },
  preload = false,
): RemoteOptionsResult {
  const trimmed = search.trim();
  if (trimmed === "" && !preload) return { status: "idle", query: "" };
  if (query.isError) {
    return {
      status: "error",
      query: trimmed,
      onRetry: () => {
        void query.refetch();
      },
    };
  }
  if (!query.data || query.isFetching) return { status: "loading", query: trimmed };
  const matches = query.data;
  return {
    status: "ready",
    query: trimmed,
    options: matches.slice(0, VISIBLE_LIMIT),
    hasMore: matches.length > VISIBLE_LIMIT || query.data.length >= API_LIMIT,
  };
}
