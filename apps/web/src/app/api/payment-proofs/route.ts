import { createTRPCContext, receivePaymentProof } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const ctx = await createTRPCContext({
    session: await auth.getSession({ headers: request.headers }),
    headers: request.headers,
  });
  return receivePaymentProof(ctx, request);
}
