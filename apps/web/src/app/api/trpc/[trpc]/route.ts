import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";

const TRPC_ENDPOINT = "/api/trpc";
const isDevelopment = globalThis.process.env.NODE_ENV === "development";

function handleTRPCRequest(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req: request,
    router: appRouter,
    createContext: async () =>
      createTRPCContext({ session: await auth.getSession({ headers: request.headers }) }),
    onError: ({ path, error }) => {
      if (isDevelopment) {
        process.stderr.write(`>>> tRPC failed on ${path ?? "<no-path>"}: ${error.message}\n`);
      }
    },
  });
}

export { handleTRPCRequest as GET, handleTRPCRequest as POST };
