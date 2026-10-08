"use client";
import { useState } from "react";
import { trpc, type QueryResult } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";

export type MembershipMode = "ENTRY" | "RETURN";
type MembershipInput = { classId: string; mode: MembershipMode; onDone: () => void };
type Choice = {
  search: string;
  selectedId: string;
  stageId: string;
  date: string;
  error: string | null;
  setError: (value: string | null) => void;
  setSearch: (value: string) => void;
  setSelectedId: (value: string) => void;
  setStageId: (value: string) => void;
  setDate: (value: string) => void;
};
type MembershipState = Choice & {
  submit: () => void;
  pending: boolean;
  students: RouterOutputs["enrollment"]["searchCandidates"];
  paused: RouterOutputs["enrollment"]["pausedSearch"];
  searching: boolean;
  searchFailed: boolean;
};
function useChoice(): Choice {
  const [search, saveSearch] = useState("");
  const [selectedId, saveSelectedId] = useState("");
  const [stageId, saveStageId] = useState("");
  const [date, saveDate] = useState(() => formatDateOnlyBR(toDateOnlySaoPaulo(new Date())));
  const [error, setError] = useState<string | null>(null);
  return {
    search,
    selectedId,
    stageId,
    date,
    error,
    setError,
    setSearch: (value) => {
      saveSearch(value);
      saveSelectedId("");
      setError(null);
    },
    setSelectedId: (value) => {
      saveSelectedId(value);
      setError(null);
    },
    setStageId: (value) => {
      saveStageId(value);
      setError(null);
    },
    setDate: (value) => {
      saveDate(maskDateBR(value));
      setError(null);
    },
  };
}
function useMembershipMutations(
  input: MembershipInput,
  choice: Choice,
): { submit: () => void; pending: boolean } {
  const utils = trpc.useUtils();
  async function done(): Promise<void> {
    await Promise.all([
      utils.classes.byId.invalidate({ id: input.classId }),
      utils.classes.roster.invalidate({ id: input.classId }),
      utils.classes.actions.invalidate({ id: input.classId }),
      utils.classes.list.invalidate(),
    ]);
    input.onDone();
  }
  const create = trpc.enrollment.create.useMutation({
    onSuccess: done,
    onError: (cause) => choice.setError(cause.message),
  });
  const returning = trpc.enrollment.return.useMutation({
    onSuccess: done,
    onError: (cause) => choice.setError(cause.message),
  });
  function submit(): void {
    const iso = parseDateBR(choice.date);
    if (!choice.selectedId || !iso) {
      choice.setError("Selecione o aluno e informe uma data válida.");
      return;
    }
    const effectiveDate = new Date(iso);
    const stage = choice.stageId ? { stageId: choice.stageId } : {};
    if (input.mode === "ENTRY")
      create.mutate({
        studentId: choice.selectedId,
        classId: input.classId,
        entryDate: effectiveDate,
        ...stage,
      });
    else
      returning.mutate({
        sourceEnrollmentId: choice.selectedId,
        targetClassId: input.classId,
        effectiveDate,
        ...stage,
      });
  }
  return { submit, pending: create.isPending || returning.isPending };
}
function useEligibleStudents(
  input: MembershipInput,
  choice: Choice,
): QueryResult<MembershipState["students"]> {
  const entryDate = parseDateBR(choice.date);
  return trpc.enrollment.searchCandidates.useQuery(
    {
      query: choice.search,
      classId: input.classId,
      ...(entryDate ? { entryDate: new Date(entryDate) } : {}),
      ...(choice.stageId ? { stageId: choice.stageId } : {}),
    },
    { enabled: input.mode === "ENTRY" && entryDate !== null },
  );
}
export function useMembershipState(input: MembershipInput): MembershipState {
  const choice = useChoice();
  const studentResults = useEligibleStudents(input, choice);
  const pausedResults = trpc.enrollment.pausedSearch.useQuery(
    { query: choice.search },
    { enabled: input.mode === "RETURN" },
  );
  const eligibleChoice = {
    ...choice,
    selectedId:
      input.mode === "ENTRY" &&
      !studentResults.data?.some((student) => student.id === choice.selectedId)
        ? ""
        : choice.selectedId,
  };
  const operations = useMembershipMutations(input, eligibleChoice);
  return {
    ...eligibleChoice,
    ...operations,
    students: studentResults.data ?? [],
    paused: pausedResults.data ?? [],
    searching: input.mode === "ENTRY" ? studentResults.isFetching : pausedResults.isFetching,
    searchFailed: input.mode === "ENTRY" ? studentResults.isError : pausedResults.isError,
  };
}
