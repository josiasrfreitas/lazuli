"use client";

import { useState } from "react";
import {
  type RemoteOptionsResult,
  type TableFilterField,
  type TableFilterOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { ContractFilters } from "./contract-filters";

const PARTY_RESULT_LIMIT = 20;
const STATUS_OPTIONS = [
  { id: "INADIMPLENTE", label: "Inadimplente" },
  { id: "EM_DIA", label: "Em dia" },
  { id: "QUITADO", label: "Quitado" },
  { id: "SEM_SALDO", label: "Sem saldo a cobrar" },
  { id: "CANCELADO", label: "Cancelada" },
];
type PartyRow = { id: string; name: string };
type PartyResultInput = {
  query: string;
  data: PartyRow[] | undefined;
  error: boolean;
  fetching: boolean;
  retry: () => void;
};

function partyResult(input: PartyResultInput): RemoteOptionsResult {
  const { data, error, fetching, retry } = input;
  const query = input.query.trim();
  if (!query) return { status: "idle", query: "" };
  if (error) return { status: "error", query, onRetry: retry };
  if (fetching || !data) return { status: "loading", query };
  return {
    status: "ready",
    query,
    options: data.map((row) => ({ id: row.id, label: row.name })),
    hasMore: data.length >= PARTY_RESULT_LIMIT,
  };
}

type PartiesQuery = {
  data: { payers: PartyRow[]; students: PartyRow[] } | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};

function lookup(input: {
  search: string;
  parties: PartiesQuery;
  kind: "payers" | "students";
}): RemoteOptionsResult {
  return partyResult({
    query: input.search,
    data: input.parties.data?.[input.kind],
    error: input.parties.isError,
    fetching: input.parties.isFetching,
    retry: () => {
      input.parties.refetch();
    },
  });
}

type PartyFieldInput = {
  id: string;
  label: string;
  selectedId: string | undefined;
  selectedOptions: TableFilterOption[];
  search: string;
  result: RemoteOptionsResult;
  onSearchChange: (value: string) => void;
  onSelectedChange: (id: string | null) => void;
};

function partyField(input: PartyFieldInput): TableFilterField {
  return {
    id: input.id,
    label: input.label,
    kind: "remote-options",
    promoted: true,
    selected: input.selectedId ? [input.selectedId] : [],
    selectedOptions: input.selectedOptions,
    search: input.search,
    result: input.result,
    onSearchChange: input.onSearchChange,
    onChange: (ids) => input.onSelectedChange(ids.at(-1) ?? null),
    onClear: () => input.onSelectedChange(null),
  };
}

function termField(filters: ContractFilters): TableFilterField {
  return {
    id: "term",
    label: "Vigência",
    kind: "period",
    promoted: true,
    from: filters.startsFrom ?? "",
    to: filters.endsTo ?? "",
    onChange: (from, to) => {
      if (from && to && from > to) {
        if (from === filters.startsFrom) from = "";
        else to = "";
      }
      filters.setFilters({ vigenciaDe: from || null, vigenciaAte: to || null });
    },
    onClear: () => filters.setFilters({ vigenciaDe: null, vigenciaAte: null }),
  };
}

function statusField(filters: ContractFilters): TableFilterField {
  return {
    id: "status",
    label: "Situação",
    kind: "options",
    options: STATUS_OPTIONS,
    selected: filters.status ? [filters.status] : [],
    onChange: (ids) => filters.setFilters({ situacao: ids.at(-1) ?? null }),
    onClear: () => filters.setFilters({ situacao: null }),
  };
}

export function useContractFilterFields(filters: ContractFilters): TableFilterField[] {
  const [search, setSearch] = useState("");
  const parties = trpc.finance.searchContractParties.useQuery(
    { query: search.trim() },
    { enabled: search.trim().length > 0 },
  );
  const payer = trpc.finance.searchContractParties.useQuery(
    { query: filters.payerId ?? "" },
    { enabled: Boolean(filters.payerId) },
  );
  const student = trpc.finance.searchContractParties.useQuery(
    { query: filters.studentId ?? "" },
    { enabled: Boolean(filters.studentId) },
  );
  return [
    partyField({
      id: "payer",
      label: "Pagador",
      selectedId: filters.payerId,
      selectedOptions: (payer.data?.payers ?? []).map((row) => ({ id: row.id, label: row.name })),
      search,
      result: lookup({ search, parties, kind: "payers" }),
      onSearchChange: setSearch,
      onSelectedChange: (id) => filters.setFilters({ pagador: id }),
    }),
    partyField({
      id: "student",
      label: "Beneficiário",
      selectedId: filters.studentId,
      selectedOptions: (student.data?.students ?? []).map((row) => ({
        id: row.id,
        label: row.name,
      })),
      search,
      result: lookup({ search, parties, kind: "students" }),
      onSearchChange: setSearch,
      onSelectedChange: (id) => filters.setFilters({ beneficiario: id }),
    }),
    termField(filters),
    statusField(filters),
  ];
}
