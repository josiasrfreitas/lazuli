import { NextResponse, type NextRequest } from "next/server";

/**
 * Carry the requested destination into page guards. Authorization stays in the
 * route and API boundaries; prefetching never changes the active experience.
 */
export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const destination = request.nextUrl.clone();
  destination.searchParams.delete("_rsc");
  requestHeaders.set("x-lazuli-page-url", `${destination.pathname}${destination.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api/|_next/|.*[.][^/]+$).*)"],
};
