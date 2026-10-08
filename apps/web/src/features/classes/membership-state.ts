"use client";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { maskDateBR, parseDateBR } from "~/lib/masks";

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
  students: RouterOutputs["students"]["search"];
  paused: RouterOutputs["enrollment"]["pausedSearch"];
  searching: boolean;
};
function useChoice(): Choice {
  const [search, saveSearch] = useState("");
  const [selectedId, saveSelectedId] = useState("");
  const [stageId, saveStageId] = useState("");
  const [date, saveDate] = useState("");
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
export function useMembershipState(input: MembershipInput): MembershipState {
  const choice = useChoice();
  const studentResults = trpc.students.search.useQuery(
    { query: choice.search },
    { enabled: input.mode === "ENTRY" && choice.search.trim().length >= 2 },
  );
  const pausedResults = trpc.enrollment.pausedSearch.useQuery(
    { query: choice.search },
    { enabled: input.mode === "RETURN" && choice.search.trim().length >= 2 },
  );
  const operations = useMembershipMutations(input, choice);
  return {
    ...choice,
    ...operations,
    students: studentResults.data?.filter((student) => student.status === "ACTIVE") ?? [],
    paused: pausedResults.data ?? [],
    searching: studentResults.isPending || pausedResults.isPending,
  };
}
