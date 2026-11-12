import { networkInterfaces } from "node:os";
import { auth } from "@lazuli/auth/server";
export async function GET(request: Request): Promise<Response> {
  if (!(await auth.getSession({ headers: request.headers })))
    return new Response(null, { status: 401 });
  let origin: string | null = null;
  const host = request.headers.get("host") ?? "";
  if (process.env.NODE_ENV === "development" && /(^localhost|\.localhost)(:|$)/u.test(host)) {
    const address = Object.values(networkInterfaces())
      .flat()
      .find(
        (entry) =>
          entry?.family === "IPv4" &&
          !entry.internal &&
          /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(entry.address),
      );
    if (address) origin = `http://${address.address}:${process.env.LAZULI_WEB_PORT ?? "3000"}`;
  }
  return Response.json({ origin }, { headers: { "Cache-Control": "private, no-store" } });
}
