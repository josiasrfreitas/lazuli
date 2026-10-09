"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Input,
  TableFilters,
  type RemoteOptionsResult,
  type TableFilterField,
  type TableFilterOption,
} from "@lazuli/ui";
import { debounce } from "~/lib/debounce";
import { CONTRACT_SEARCH_MAX_LENGTH, type ContractFilters } from "./contract-filters";
import { trpc } from "~/lib/trpc";

const SEARCH_DEBOUNCE_MS = 300;
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

type ContractPartyFiltersInput = {
  filters: ContractFilters;
  search: string;
  parties: PartiesQuery;
  payerOptions: TableFilterOption[];
  studentOptions: TableFilterOption[];
  setSearch: (value: string) => void;
};

function contractPartyFilterFields(input: ContractPartyFiltersInput): TableFilterField[] {
  const { filters, search, parties, payerOptions, studentOptions, setSearch } = input;
  return [
    partyField({
      id: "payer",
      label: "Pagador",
      selectedId: filters.payerId,
      selectedOptions: payerOptions,
      search,
      result: lookup({ search, parties, kind: "payers" }),
      onSearchChange: setSearch,
      onSelectedChange: (id) => filters.setFilters({ pagador: id }),
    }),
    partyField({
      id: "student",
      label: "Beneficiário",
      selectedId: filters.studentId,
      selectedOptions: studentOptions,
      search,
      result: lookup({ search, parties, kind: "students" }),
      onSearchChange: setSearch,
      onSelectedChange: (id) => filters.setFilters({ beneficiario: id }),
    }),
  ];
}

function contractTermFilterField(filters: ContractFilters): TableFilterField {
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

function contractStatusFilterField(filters: ContractFilters): TableFilterField {
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

function useContractFilterFields(filters: ContractFilters): TableFilterField[] {
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
    ...contractPartyFilterFields({
      filters,
      search,
      parties,
      payerOptions: (payer.data?.payers ?? []).map((row) => ({ id: row.id, label: row.name })),
      studentOptions: (student.data?.students ?? []).map((row) => ({
        id: row.id,
        label: row.name,
      })),
      setSearch,
    }),
    contractTermFilterField(filters),
    contractStatusFilterField(filters),
  ];
}

function ContractSearch({ filters }: { filters: ContractFilters }): ReactElement {
  const [value, setValue] = useState(filters.search);
  const location = useSearchParams().toString();
  const commit = useMemo(
    () =>
      debounce(
        (search: string) => filters.setFilters({ busca: search || null }),
        SEARCH_DEBOUNCE_MS,
      ),
    [filters.setFilters],
  );
  useEffect(() => {
    setValue(filters.search);
    commit.cancel();
  }, [filters.search, location, commit]);
  useEffect(() => () => commit.cancel(), [commit]);
  return (
    <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
      />
      <Input
        aria-label="Buscar contrato por aluno ou pagador"
        className="pl-8"
        type="search"
        placeholder="Buscar aluno ou pagador"
        maxLength={CONTRACT_SEARCH_MAX_LENGTH}
        size="sm"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          commit(event.target.value);
        }}
      />
    </div>
  );
}

export function ContractsToolbar({
  filters,
  onNew,
}: {
  filters: ContractFilters;
  onNew: () => void;
}): ReactElement {
  const fields = useContractFilterFields(filters);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <ContractSearch filters={filters} />
      <TableFilters
        fields={fields}
        onClearAll={() =>
          filters.setFilters({
            pagador: null,
            beneficiario: null,
            vigenciaDe: null,
            vigenciaAte: null,
            situacao: null,
          })
        }
      />
      <Button onClick={onNew} size="sm">
        <Plus aria-hidden="true" className="size-4" />
        Novo contrato
      </Button>
    </div>
  );
}
