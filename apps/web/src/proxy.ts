import { NextResponse, type NextRequest } from "next/server";

/**
 * Carry the requested destination into page guards. Authorization stays in the
 * route and API boundaries; prefetching never changes the active experience.
 */
export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    const destination = request.nextUrl.clone();
    destination.searchParams.delete("_rsc");
    requestHeaders.set("x-lazuli-page-url", `${destination.pathname}${destination.search}`);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!api/|_next/|.*[.][^/]+$).*)"],
};
