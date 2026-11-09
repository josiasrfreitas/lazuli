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
    onError: ({ path, error, type, ctx }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        const cause = safeError(error.cause);
        const failure = safeError(error);
        requestLogger.error(
          {
            procedure: path,
            procedure_type: type,
            operation: request.method,
            user_id: ctx?.staffUser?.id,
            error_code: error.code,
            error_cause_name: cause.error_name,
            ...(cause.error_code ? { error_cause_code: cause.error_code } : {}),
            error_name: failure.error_name,
            error_stack: cause.error_stack ?? failure.error_stack,
            diagnostic_state: {
              procedure: path,
              procedure_type: type,
              operation: request.method,
              authenticated: Boolean(ctx?.staffUser),
            },
          },
          "Internal failure while processing operation",
        );
      }
    },
  });
}

export { handleTRPCRequest as GET, handleTRPCRequest as POST };
