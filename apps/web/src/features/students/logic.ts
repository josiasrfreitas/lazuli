"use client";

import { useCallback, useEffect } from "react";

import { keepPreviousData, skipToken } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";

import {
  MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE,
  MINOR_REQUIRES_GUARDIAN_MESSAGE,
  civilDateSchema,
  z,
  studentPaginationPolicy,
  type StudentListInput,
  type StudentListOutput,
  type StudentListRow,
} from "@lazuli/validators";

import { trpc, type ClientError, type QueryResult } from "~/lib/trpc";
import { useUrlPagination } from "~/lib/pagination";

import type { NewStudentErrors, NewStudentFieldName } from "./new-student/reducer";
import type { StudentCreateInput } from "./new-student/to-create-input";

/**
 * Client state of the listing: filters live in the URL (nuqs) so a filtered
 * view survives refresh and can be shared; data comes through the tRPC hooks.
 * This module is the feature's only import point of both.
 */

const searchParamsConfig = {
  status: parseAsString,
  busca: parseAsString.withDefault(""),
  situacoes: parseAsString,
  turmas: parseAsString,
  professores: parseAsString,
  cadastroDe: parseAsString,
  cadastroAte: parseAsString,
};

export type StudentFilterPatch = Partial<{
  situations: string | null;
  classIds: string | null;
  teacherIds: string | null;
  registeredFrom: string | null;
  registeredTo: string | null;
}>;

function ids(value: string | null): string[] {
  return value?.split(",").filter(Boolean) ?? [];
}

const uuidSchema = z.string().uuid();
const MAX_FILTER_IDS = 50;
const SEARCH_MAX_LENGTH = 80;

export function filterIdsFromUrl(value: string | null): string[] {
  return [...new Set(ids(value).filter((id) => uuidSchema.safeParse(id).success))].slice(
    0,
    MAX_FILTER_IDS,
  );
}

function validDate(value: string | null): string {
  return value && civilDateSchema.safeParse(value).success ? value : "";
}

function situations(value: string | null): Array<"active" | "inactive"> {
  return [
    ...new Set(
      ids(value).filter(
        (item): item is "active" | "inactive" => item === "active" || item === "inactive",
      ),
    ),
  ];
}

export type StudentsFilters = {
  situations: Array<"active" | "inactive">;
  classIds: string[];
  teacherIds: string[];
  registeredFrom: string;
  registeredTo: string;
  search: string;
  page: number;
  pageSize: StudentListInput["pageSize"];
  setFilters: (patch: StudentFilterPatch) => void;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
};

/** Filters live in the URL; changing one resets the page. */
export function useStudentsFilters(): StudentsFilters {
  const [params, setParams] = useQueryStates(searchParamsConfig);
  const pagination = useUrlPagination(studentPaginationPolicy);
  const registeredFrom = validDate(params.cadastroDe);
  const registeredTo = validDate(params.cadastroAte);
  useEffect(() => {
    if (params.status !== "ativos" && params.status !== "inativos") return;
    void setParams({
      status: null,
      situacoes: params.situacoes ?? (params.status === "ativos" ? "active" : "inactive"),
    });
  }, [params.status, params.situacoes, setParams]);
  const setSearch = useCallback(
    (value: string) => {
      void setParams({ busca: value === "" ? null : value });
      pagination.setPage(1);
    },
    [pagination, setParams],
  );

  return {
    situations:
      params.status === "ativos" && !params.situacoes
        ? ["active"]
        : params.status === "inativos" && !params.situacoes
          ? ["inactive"]
          : situations(params.situacoes),
    classIds: filterIdsFromUrl(params.turmas),
    teacherIds: filterIdsFromUrl(params.professores),
    registeredFrom:
      registeredFrom && registeredTo && registeredFrom > registeredTo ? "" : registeredFrom,
    registeredTo:
      registeredFrom && registeredTo && registeredFrom > registeredTo ? "" : registeredTo,
    search: params.busca.slice(0, SEARCH_MAX_LENGTH),
    page: pagination.page,
    pageSize: pagination.pageSize,
    setFilters: (patch) => {
      void setParams({
        ...(patch.situations !== undefined ? { situacoes: patch.situations } : {}),
        ...(patch.classIds !== undefined ? { turmas: patch.classIds } : {}),
        ...(patch.teacherIds !== undefined ? { professores: patch.teacherIds } : {}),
        ...(patch.registeredFrom !== undefined ? { cadastroDe: patch.registeredFrom } : {}),
        ...(patch.registeredTo !== undefined ? { cadastroAte: patch.registeredTo } : {}),
      });
      pagination.setPage(1);
    },
    setSearch,
    setPage: pagination.setPage,
    setPageSize: pagination.setPageSize,
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

type StudentsListQueryInput = Pick<
  StudentsFilters,
  | "situations"
  | "classIds"
  | "teacherIds"
  | "registeredFrom"
  | "registeredTo"
  | "search"
  | "page"
  | "pageSize"
>;

export function useStudentFilterOptions(kind: "class" | "teacher", search: string) {
  return trpc.students.listFilterOptions.useQuery(
    { kind, search },
    { enabled: search.trim().length > 0 },
  );
}

export function useSelectedStudentFilterOptions(kind: "class" | "teacher", ids: string[]) {
  return trpc.students.listFilterOptions.useQuery({ kind, ids }, { enabled: ids.length > 0 });
}

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
      page: filters.page,
      pageSize: filters.pageSize,
      status: "all",
      search: filters.search === "" ? undefined : filters.search,
      ...(filters.situations.length ? { situations: filters.situations } : {}),
      ...(filters.classIds.length ? { classIds: filters.classIds } : {}),
      ...(filters.teacherIds.length ? { teacherIds: filters.teacherIds } : {}),
      ...(filters.registeredFrom ? { registeredFrom: filters.registeredFrom } : {}),
      ...(filters.registeredTo ? { registeredTo: filters.registeredTo } : {}),
    },
    { placeholderData: keepPreviousData },
  );
}
