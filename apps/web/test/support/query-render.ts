import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, trpc } from "../../src/lib/trpc.js";

export function renderWithQueries(element: ReactElement): string {
  const queryClient = new QueryClient();
  try {
    return renderToStaticMarkup(
      createElement(trpc.Provider, {
        client: createTRPCClient(),
        queryClient,
        children: createElement(QueryClientProvider, { client: queryClient }, element),
      }),
    );
  } finally {
    queryClient.clear();
  }
}
