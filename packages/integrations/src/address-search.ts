import {
  AutocompleteCommand,
  GetPlaceCommand,
  GeoPlacesClient,
  type GetPlaceCommandOutput,
} from "@aws-sdk/client-geo-places";
import { readAddressSearchRegion } from "./address-search/env.js";

const ADDRESS_SEARCH_TIMEOUT_MS = 5000;

export interface AddressSuggestion {
  id: string;
  label: string;
}

export interface ResolvedAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

let client: GeoPlacesClient | undefined;
function places(): GeoPlacesClient {
  client ??= new GeoPlacesClient({
    region: readAddressSearchRegion(),
    maxAttempts: 1,
  });
  return client;
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const result = await places().send(
    new AutocompleteCommand({
      QueryText: query,
      Filter: { IncludeCountries: ["BRA"] },
      Language: "pt-BR",
      MaxResults: 5,
    }),
    { abortSignal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS) },
  );
  return (result.ResultItems ?? []).flatMap((item) =>
    item.PlaceId && item.Address?.Label ? [{ id: item.PlaceId, label: item.Address.Label }] : [],
  );
}

/** Suggestions are transient; fetch storage-authorized details before persisting an address. */
export async function resolveAddress(placeId: string): Promise<ResolvedAddress> {
  const result = await places().send(
    new GetPlaceCommand({
      PlaceId: placeId,
      Language: "pt-BR",
      IntendedUse: "Storage",
    }),
    { abortSignal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS) },
  );
  const address = result.Address;
  if (!address || address.Country?.Code3 !== "BRA") throw new Error("Address unavailable");
  return toResolvedAddress(address);
}

function toResolvedAddress(
  address: NonNullable<GetPlaceCommandOutput["Address"]>,
): ResolvedAddress {
  return {
    street: address.Street ?? "",
    number: address.AddressNumber ?? "",
    complement: "",
    neighborhood: address.District ?? address.SubDistrict ?? "",
    city: address.Locality ?? "",
    state: address.Region?.Code ?? "",
    postalCode: address.PostalCode ?? "",
  };
}
