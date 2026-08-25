"use client";

import { keepPreviousData, skipToken } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import type {
  StudentListOutput,
  StudentListRow,
  StudentListStatusFilter,
} from "@lazuli/validators";

import { trpc, type QueryResult } from "~/lib/trpc";

import type { StatusTabValue } from "./view-model";

/**
 * Client state of the listing: filters live in the URL (nuqs) so a filtered
 * view survives refresh and can be shared; data comes through the tRPC hooks.
 * This module is the feature's only import point of both.
 */

const FIRST_PAGE = 1;

const STATUS_PARAM_VALUES = ["ativos", "inativos"] as const;

const searchParamsConfig = {
  status: parseAsStringLiteral(STATUS_PARAM_VALUES),
  busca: parseAsString.withDefault(""),
  pagina: parseAsInteger.withDefault(FIRST_PAGE),
};

const STATUS_FILTER_BY_TAB: Record<StatusTabValue, StudentListStatusFilter> = {
  todos: "all",
  ativos: "active",
  inativos: "inactive",
};

export type StudentsFilters = {
  statusTab: StatusTabValue;
  busca: string;
  pagina: number;
  setStatusTab: (value: StatusTabValue) => void;
  setBusca: (value: string) => void;
  setPagina: (value: number) => void;
};

/** Defaults are cleared from the URL; changing status or search resets the page. */
export function useStudentsFilters(): StudentsFilters {
  const [params, setParams] = useQueryStates(searchParamsConfig);

  return {
    statusTab: params.status ?? "todos",
    busca: params.busca,
    pagina: params.pagina,
    setStatusTab: (value) => {
      void setParams({ status: value === "todos" ? null : value, pagina: null });
    },
    setBusca: (value) => {
      void setParams({ busca: value === "" ? null : value, pagina: null });
    },
    setPagina: (value) => {
      void setParams({ pagina: value <= FIRST_PAGE ? null : value });
    },
  };
}

export type SelectedStudent = {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
};

/** `?aluno=<id>` drives the preview panel and survives filter changes (IA). */
export function useSelectedStudent(): SelectedStudent {
  const [params, setParams] = useQueryStates({ aluno: parseAsString });

  return {
    selectedId: params.aluno,
    select: (id) => {
      void setParams({ aluno: id });
    },
    clear: () => {
      void setParams({ aluno: null });
    },
  };
}

export type StudentPreviewQuery = QueryResult<StudentListRow>;

export function useStudentPreview(id: string | null): StudentPreviewQuery {
  return trpc.students.preview.useQuery(id === null ? skipToken : { id });
}

type StudentsListQueryInput = Pick<StudentsFilters, "statusTab" | "busca" | "pagina">;

export type StudentsListQuery = QueryResult<StudentListOutput>;

/** Previous rows stay on screen while a page or filter change is in flight. */
export function useStudentsList(filters: StudentsListQueryInput): StudentsListQuery {
  return trpc.students.list.useQuery(
    {
      page: filters.pagina,
      status: STATUS_FILTER_BY_TAB[filters.statusTab],
      search: filters.busca === "" ? undefined : filters.busca,
    },
    { placeholderData: keepPreviousData },
  );
}
