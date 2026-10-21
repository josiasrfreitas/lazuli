import { createTRPCContext, downloadAssessmentFile } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await createTRPCContext({
    session: await auth.getSession({ headers: request.headers }),
    headers: request.headers,
  });
  const { id } = await params;
  return downloadAssessmentFile(ctx, id);
}
