"use client";

import { useCallback } from "react";

import { keepPreviousData, skipToken } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  DEFAULT_STUDENT_PAGE_SIZE,
  MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE,
  MINOR_REQUIRES_GUARDIAN_MESSAGE,
  STUDENT_PAGE_SIZE_OPTIONS,
  type StudentListInput,
  type StudentListOutput,
  type StudentListRow,
  type StudentListStatusFilter,
} from "@lazuli/validators";

import { trpc, type ClientError, type QueryResult } from "~/lib/trpc";

import type { NewStudentErrors, NewStudentFieldName } from "./new-student/reducer";
import type { StudentCreateInput } from "./new-student/to-create-input";
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
  porPagina: parseAsInteger.withDefault(DEFAULT_STUDENT_PAGE_SIZE),
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
  pageSize: StudentListInput["pageSize"];
  setStatusTab: (value: StatusTabValue) => void;
  setBusca: (value: string) => void;
  setPagina: (value: number) => void;
  setPageSize: (value: StudentListInput["pageSize"]) => void;
};

function studentPageSizeFor(value: number): StudentListInput["pageSize"] {
  return STUDENT_PAGE_SIZE_OPTIONS.find((option) => option === value) ?? DEFAULT_STUDENT_PAGE_SIZE;
}

/** Defaults are cleared from the URL; changing status or search resets the page. */
export function useStudentsFilters(): StudentsFilters {
  const [params, setParams] = useQueryStates(searchParamsConfig);
  const setBusca = useCallback(
    (value: string) => {
      void setParams({ busca: value === "" ? null : value, pagina: null });
    },
    [setParams],
  );

  return {
    statusTab: params.status ?? "todos",
    busca: params.busca,
    pagina: params.pagina,
    pageSize: studentPageSizeFor(params.porPagina),
    setStatusTab: (value) => {
      void setParams({ status: value === "todos" ? null : value, pagina: null });
    },
    setBusca,
    setPagina: (value) => {
      void setParams({ pagina: value <= FIRST_PAGE ? null : value });
    },
    setPageSize: (value) => {
      void setParams({
        pagina: null,
        porPagina: value === DEFAULT_STUDENT_PAGE_SIZE ? null : value,
      });
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

type StudentsListQueryInput = Pick<StudentsFilters, "statusTab" | "busca" | "pagina" | "pageSize">;

export type StudentsListQuery = QueryResult<StudentListOutput>;

export type ServerRejection = { errors: NewStudentErrors; formError: string | null };

/** Server field key → wizard field. `guardian` is nested; its errors land on the name. */
const FIELD_BY_SERVER_KEY = new Map<string, NewStudentFieldName>([
  ["fullName", "fullName"],
  ["phone", "phone"],
  ["email", "email"],
  ["birthDate", "birthDate"],
  ["documentType", "documentType"],
  ["documentNumber", "documentNumber"],
  ["guardian", "guardianName"],
]);

const CREATE_FAILED_MESSAGE = "Não foi possível criar o aluno. Tente de novo.";

function zodFieldErrors(error: ClientError): NewStudentErrors {
  const entries: [NewStudentFieldName, string][] = [];

  for (const [key, messages] of Object.entries(error.data?.zodError?.fieldErrors ?? {})) {
    const field = FIELD_BY_SERVER_KEY.get(key);
    const message = messages?.[0];

    if (field !== undefined && message !== undefined) {
      entries.push([field, message]);
    }
  }

  return Object.fromEntries(entries);
}

function businessRuleErrors(message: string): NewStudentErrors {
  if (message === MINOR_REQUIRES_GUARDIAN_MESSAGE) {
    return { guardianName: message };
  }

  if (message === MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE) {
    return { guardianPhone: message };
  }

  return {};
}

/**
 * Maps a `students.create` rejection to wizard fields: zod issues by field
 * name, the two guardian business rules by their exact messages, anything
 * else as a form-level error.
 */
export function serverRejectionFor(error: ClientError): ServerRejection {
  const errors = { ...zodFieldErrors(error), ...businessRuleErrors(error.message) };

  return { errors, formError: Object.keys(errors).length > 0 ? null : CREATE_FAILED_MESSAGE };
}

export type CreateStudentHandlers = {
  onCreated: (id: string) => void;
  onRejected: (rejection: ServerRejection) => void;
};

export type CreateStudent = {
  create: (input: StudentCreateInput) => void;
  isPending: boolean;
};

/** Creating invalidates the listing, so the new student shows up in the table. */
export function useCreateStudent(handlers: CreateStudentHandlers): CreateStudent {
  const utils = trpc.useUtils();
  const mutation = trpc.students.create.useMutation({
    onSuccess: async (created) => {
      await utils.students.list.invalidate();
      handlers.onCreated(created.id);
    },
    onError: (error) => {
      handlers.onRejected(serverRejectionFor(error));
    },
  });

  return {
    create: (input) => {
      mutation.mutate(input);
    },
    isPending: mutation.isPending,
  };
}

/** Previous rows stay on screen while a page or filter change is in flight. */
export function useStudentsList(filters: StudentsListQueryInput): StudentsListQuery {
  return trpc.students.list.useQuery(
    {
      page: filters.pagina,
      pageSize: filters.pageSize,
      status: STATUS_FILTER_BY_TAB[filters.statusTab],
      search: filters.busca === "" ? undefined : filters.busca,
    },
    { placeholderData: keepPreviousData },
  );
}
