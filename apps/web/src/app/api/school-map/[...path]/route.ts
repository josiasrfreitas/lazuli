import { createTRPCContext, schoolMapResponse } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = await createTRPCContext({
    session: await auth.getSession({ headers: request.headers }),
    headers: request.headers,
  });
  return schoolMapResponse(context, request);
}
