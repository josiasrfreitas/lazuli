import { createTRPCContext, studentDocumentCapture } from "@lazuli/api";
export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return studentDocumentCapture(
    await createTRPCContext({ session: null, headers: request.headers }),
    { request },
  );
}
