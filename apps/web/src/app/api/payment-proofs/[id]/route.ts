import { createTRPCContext, downloadPaymentProof } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = await createTRPCContext({
    session: await auth.getSession({ headers: request.headers }),
    headers: request.headers,
  });
  return downloadPaymentProof(ctx, (await params).id);
}
