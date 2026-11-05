import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";
import {
  createServiceLogger,
  requestIdFromHeaders,
  safeError,
  withCheckpoint,
} from "@lazuli/logging";

const TRPC_ENDPOINT = "/api/trpc";
const logger = createServiceLogger("web");

function handleTRPCRequest(request: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(request.headers);
  const requestLogger = logger.child({ request_id: requestId });
  return fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req: request,
    router: appRouter,
    createContext: async () =>
      createTRPCContext({
        session: await withCheckpoint(requestLogger, {
          checkpoint: "auth_session",
          action: () => auth.getSession({ headers: request.headers }),
        }),
        headers: request.headers,
        requestId,
      }),
    onError: ({ path, error }) => {
      if (error.code === "INTERNAL_SERVER_ERROR")
        requestLogger.error(
          { procedure: path, error_code: error.code, ...safeError(error) },
          "tRPC request failed",
        );
    },
  });
}

export { handleTRPCRequest as GET, handleTRPCRequest as POST };
