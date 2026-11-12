import { createTRPCContext, teacherMobileCapture } from "@lazuli/api";
export const runtime = "nodejs";
async function handle(request: Request): Promise<Response> {
  return teacherMobileCapture(
    await createTRPCContext({ session: null, headers: request.headers }),
    request,
  );
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
