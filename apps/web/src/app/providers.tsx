"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";

import { createTRPCClient, trpc } from "~/lib/trpc";

/**
 * Client-side providers for the whole app: TanStack Query cache, the tRPC hooks
 * bound to it, and the nuqs adapter that keeps filter state in the URL.
 * Both clients are created once per browser session via lazy `useState`.
 */

const STALE_TIME_MILLISECONDS = 30_000;

export function Providers({ children }: { children: ReactNode }): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: STALE_TIME_MILLISECONDS, refetchOnWindowFocus: false },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
