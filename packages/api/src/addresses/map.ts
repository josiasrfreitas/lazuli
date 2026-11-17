import { readSchoolMapAsset } from "@lazuli/integrations/school-map";
import { createServiceLogger, safeError } from "@lazuli/logging";
import type { Context } from "../trpc/context.js";

const logger = createServiceLogger("web");
const BASE_PATH = "/api/school-map/";

export async function schoolMapResponse(context: Context, request: Request): Promise<Response> {
  if (!context.staffUser) return new Response(null, { status: 401 });
  if (context.staffUser.role !== "ADMIN" && context.staffUser.role !== "SYSTEM_ADMIN")
    return new Response(null, { status: 403 });
  const url = new URL(request.url);
  try {
    const asset = await readSchoolMapAsset({
      path: url.pathname.slice(BASE_PATH.length).split("/").map(decodeURIComponent),
      dark: url.searchParams.get("theme") !== "light",
      baseUrl: BASE_PATH.slice(0, -1),
    });
    if (!asset) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(asset.body).buffer, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": `private, ${asset.cacheControl.replace(/\bpublic,?\s*/gu, "")}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error({ request_id: context.requestId, ...safeError(error) }, "School map unavailable");
    return Response.json(
      { message: "Não foi possível carregar o mapa. Tente novamente." },
      { status: 503 },
    );
  }
}
