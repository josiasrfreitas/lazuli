import { TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import { searchAddresses, resolveAddress } from "@lazuli/integrations/address-search";
import { createServiceLogger, logDevelopmentProcess, safeError } from "@lazuli/logging";
import { adminProcedure, router } from "../trpc/init.js";
import type { Context } from "../trpc/context.js";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;
const MAX_PLACE_ID_LENGTH = 500;
const logger = createServiceLogger("web");

async function lookup<T>(options: {
  context: Context;
  resource: "addresses.search" | "addresses.resolve";
  start: string;
  complete: string;
  action: () => Promise<T>;
  facts: (result: T) => Record<string, number | boolean>;
}): Promise<T> {
  const started = performance.now();
  const common = {
    requestId: options.context.requestId,
    userId: options.context.staffUser?.id,
    resource: options.resource,
    operation: "API" as const,
  };
  logDevelopmentProcess(logger, { ...common, step: options.start });
  try {
    const result = await options.action();
    logDevelopmentProcess(logger, {
      ...common,
      step: options.complete,
      durationMs: Math.round(performance.now() - started),
      facts: options.facts(result),
    });
    return result;
  } catch (error) {
    logger.error(
      {
        request_id: options.context.requestId,
        user_id: options.context.staffUser?.id,
        resource: options.resource,
        operation: "API",
        duration_ms: Math.round(performance.now() - started),
        status: "error",
        ...safeError(error),
        diagnostic_state: { integration: "Amazon Location Places", operation: options.resource },
      },
      "Address lookup failed",
    );
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "A busca por endereços está indisponível. Preencha os campos manualmente ou tente novamente.",
      cause: error,
    });
  }
}

export const addressesRouter = router({
  search: adminProcedure
    .input(
      z.object({ query: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) }).strict(),
    )
    .query(({ ctx, input }) =>
      lookup({
        context: ctx,
        resource: "addresses.search",
        start: "Searching Amazon Location for address suggestions",
        complete: "Address suggestions received",
        action: () => searchAddresses(input.query),
        facts: (result) => ({ suggestions: result.length }),
      }),
    ),
  resolve: adminProcedure
    .input(z.object({ placeId: z.string().min(1).max(MAX_PLACE_ID_LENGTH) }).strict())
    .mutation(({ ctx, input }) =>
      lookup({
        context: ctx,
        resource: "addresses.resolve",
        start: "Resolving selected address details",
        complete: "Selected address resolved",
        action: () => resolveAddress(input.placeId),
        facts: (result) => ({
          street_found: Boolean(result.street),
          postal_code_found: Boolean(result.postalCode),
        }),
      }),
    ),
});
