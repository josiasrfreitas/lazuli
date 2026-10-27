import { TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import { searchAddresses, resolveAddress } from "@lazuli/integrations/address-search";
import { adminProcedure, router } from "../trpc/init.js";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;
const MAX_PLACE_ID_LENGTH = 500;

async function lookup<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Busca de endereço indisponível. Preencha os campos manualmente ou tente novamente.",
    });
  }
}

export const addressesRouter = router({
  search: adminProcedure
    .input(
      z.object({ query: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) }).strict(),
    )
    .query(({ input }) => lookup(() => searchAddresses(input.query))),
  resolve: adminProcedure
    .input(z.object({ placeId: z.string().min(1).max(MAX_PLACE_ID_LENGTH) }).strict())
    .mutation(({ input }) => lookup(() => resolveAddress(input.placeId))),
});
