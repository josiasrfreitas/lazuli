"use client";

import { useCallback } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { civilDateSchema, z } from "@lazuli/validators";

const statusSchema = z.enum(["INADIMPLENTE", "EM_DIA", "QUITADO", "SEM_SALDO", "CANCELADO"]);
export const CONTRACT_SEARCH_MAX_LENGTH = 80;
const uuidSchema = z.string().uuid();
const parsers = {
  busca: parseAsString,
  pagador: parseAsString,
  beneficiario: parseAsString,
  vigenciaDe: parseAsString,
  vigenciaAte: parseAsString,
  situacao: parseAsString,
  pagina: parseAsString,
};
type Params = { [K in keyof typeof parsers]: string | null };
export type ContractFilters = {
  search: string;
  payerId: string | undefined;
  studentId: string | undefined;
  startsFrom: string | undefined;
  endsTo: string | undefined;
  status: z.infer<typeof statusSchema> | undefined;
  page: number;
  setFilters: (patch: Partial<Params>) => void;
  setPage: (page: number) => void;
};

function valid(
  schema: { safeParse: (value: string | null) => { success: boolean; data?: string } },
  value: string | null,
): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function useContractFilters(): ContractFilters {
  const [params, setParams] = useQueryStates(parsers, { history: "push" });
  const parsedPage = z.coerce.number().int().positive().safeParse(params.pagina);
  const page = params.pagina && parsedPage.success ? parsedPage.data : 1;
  const startsFrom = valid(civilDateSchema, params.vigenciaDe);
  const endsTo = valid(civilDateSchema, params.vigenciaAte);
  const filters = {
    search: (params.busca ?? "").slice(0, CONTRACT_SEARCH_MAX_LENGTH),
    payerId: valid(uuidSchema, params.pagador),
    studentId: valid(uuidSchema, params.beneficiario),
    startsFrom,
    endsTo,
    status: valid(statusSchema, params.situacao) as z.infer<typeof statusSchema> | undefined,
    page,
  };
  const setFilters = useCallback(
    (patch: Partial<Params>) => {
      void setParams({ ...patch, pagina: null });
    },
    [setParams],
  );
  const setPage = useCallback(
    (nextPage: number) => {
      void setParams({ pagina: nextPage > 1 ? String(nextPage) : null });
    },
    [setParams],
  );
  return { ...filters, setFilters, setPage };
}
