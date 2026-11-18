import { GeoMapsClient, GetStyleDescriptorCommand, GetTileCommand } from "@aws-sdk/client-geo-maps";
import { readAddressSearchRegion } from "./address-search/env.js";

const REQUEST_TIMEOUT_MS = 8000;
const MAX_ZOOM = 22;
let client: GeoMapsClient | undefined;
type MapCommand = GetStyleDescriptorCommand | GetTileCommand;
export type MapAsset = { body: Uint8Array; contentType: string; cacheControl: string };

/** Only the assets used by the Standard base map can reach AWS. */
export function mapAssetCommand(path: string[], dark: boolean): MapCommand | null {
  if (path[0] !== "v2") return null;
  if (
    path.length === 4 &&
    path[1] === "styles" &&
    path[2] === "Standard" &&
    path[3] === "descriptor"
  )
    return new GetStyleDescriptorCommand({
      Style: "Standard",
      ColorScheme: dark ? "Dark" : "Light",
    });
  if (path.length === 6 && path[1] === "tiles" && path[2] === "vector.basemap")
    return tileCommand(path);
  return null;
}

function tileCommand(path: string[]): GetTileCommand | null {
  const coordinates = path.slice(3);
  if (coordinates.some((value) => !/^\d+$/u.test(value))) return null;
  const [zoom, horizontal, vertical] = coordinates.map(Number);
  if (zoom! > MAX_ZOOM || horizontal! >= 2 ** zoom! || vertical! >= 2 ** zoom!) return null;
  return new GetTileCommand({ Tileset: "vector.basemap", Z: path[3]!, X: path[4]!, Y: path[5]! });
}

export async function readSchoolMapAsset(input: {
  path: string[];
  dark: boolean;
  baseUrl: string;
}): Promise<MapAsset | null> {
  const command = mapAssetCommand(input.path, input.dark);
  if (!command) return null;
  const region = readAddressSearchRegion();
  client ??= new GeoMapsClient({ region, maxAttempts: 1 });
  const options = { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  const result =
    command instanceof GetTileCommand
      ? await client.send(command, options)
      : await client.send(command, options);
  if (!result.Blob && command instanceof GetStyleDescriptorCommand)
    throw new Error("Map style unavailable");
  // AWS can successfully return a vector tile with no features and no body.
  let body = result.Blob ?? new Uint8Array();
  if (command instanceof GetStyleDescriptorCommand) {
    const descriptor = new TextDecoder()
      .decode(body)
      .replaceAll(
        `https://maps.geo.${region}.amazonaws.com/v2/tiles/vector.basemap/`,
        `${input.baseUrl}/v2/tiles/vector.basemap/`,
      );
    body = new TextEncoder().encode(descriptor);
  }
  return {
    body,
    contentType: result.ContentType ?? "application/x-protobuf",
    cacheControl: result.CacheControl ?? "max-age=600",
  };
}
