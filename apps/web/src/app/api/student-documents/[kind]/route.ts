import { createTRPCContext, studentDocumentCapture } from "@lazuli/api";
export const runtime = "nodejs";
async function handle(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await params;
  return studentDocumentCapture(
    await createTRPCContext({ session: null, headers: request.headers }),
    { request, kind },
  );
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
