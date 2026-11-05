import { createCaller, createTRPCContext } from "@lazuli/api";
import { headers } from "next/headers";

/** Server-rendered callers share the request ID assigned by the Next proxy. */
export async function createPageCaller(email: string): Promise<ReturnType<typeof createCaller>> {
  const requestHeaders = await headers();
  return createCaller(
    await createTRPCContext({
      session: { user: { email } },
      headers: requestHeaders,
    }),
  );
}
