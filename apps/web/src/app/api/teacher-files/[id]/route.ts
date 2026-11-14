import { createTRPCContext, teacherFileResource } from "@lazuli/api";
import { auth } from "@lazuli/auth/server";
export const runtime = "nodejs";
async function handle(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = await createTRPCContext({
    session: await auth.getSession({ headers: request.headers }),
    headers: request.headers,
  });
  const { id } = await params;
  return teacherFileResource(ctx, { request, id });
}
export const GET = handle;
export const DELETE = handle;
