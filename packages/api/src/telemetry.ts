import { TRPCError } from "@trpc/server";
import { reportError } from "@lazuli/logging";

/** Transport fallbacks still report unexpected exceptions before returning a safe response. */
export function reportTransportError(error: Error | null, operation: string): void {
  if (!error || (error instanceof TRPCError && error.code !== "INTERNAL_SERVER_ERROR")) return;
  const original = error.cause instanceof Error ? error.cause : error;
  reportError(original, { service: "web", operation });
}
