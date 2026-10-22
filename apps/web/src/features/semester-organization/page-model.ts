"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { today } from "~/features/appointments/shared";
import { dateOnly, type ClassPlan, type Placement, type SemesterBoard } from "./shared";
import type { PlacementAction } from "./roster";

export type OrganizationAction =
  | PlacementAction
  | { kind: "newPlacement"; studentId: string }
  | { kind: "invalidate"; row: Placement; previousId: string };
type SemesterData = {
  semesters: QueryResult<RouterOutputs["semesterOrganization"]["semesters"]>;
  semesterId: string | undefined;
  query: QueryResult<SemesterBoard>;
};
export type SemesterPageModel = SemesterData & {
  params: { semestre: string | null; turma: string | null; visao: string };
  board: SemesterBoard | undefined;
  readOnly: boolean;
  selectedPlan: ClassPlan | undefined;
  selectedRows: Placement[];
  planForm: ClassPlan | "new" | null;
  setPlanForm: Dispatch<SetStateAction<ClassPlan | "new" | null>>;
  semesterForm: boolean;
  setSemesterForm: Dispatch<SetStateAction<boolean>>;
  action: OrganizationAction | null;
  setAction: Dispatch<SetStateAction<OrganizationAction | null>>;
  selectPlan: (id: string | null) => void;
  selectSemester: (id: string) => void;
  selectView: (value: string) => void;
  organizeStudent: (studentId: string) => void;
};

export function useSemesterPageModel(): SemesterPageModel {
  return useSemesterPageState();
}

const useSemesterPageState = (): SemesterPageModel => {
  const [params, setParams] = useQueryStates({
    semestre: parseAsString,
    turma: parseAsString,
    visao: parseAsString.withDefault("turmas"),
  });
  const { semesters, semesterId, query } = useSemesterData(params.semestre);
  const [planForm, setPlanForm] = useState<ClassPlan | "new" | null>(null);
  const [semesterForm, setSemesterForm] = useState(false);
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const board = query.data;
  const readOnly = board ? dateOnly(board.semester.startDate) <= today() : true;
  const selectedPlan = board?.plans.find((plan) => plan.id === params.turma);
  const selectedRows = rowsForSelection({ board, plan: selectedPlan, id: params.turma });
  const selectPlan = (id: string | null): void => void setParams({ turma: id, visao: "turmas" });
  const selectSemester = (id: string): void => void setParams({ semestre: id, turma: null });
  const selectView = (value: string): void => void setParams({ visao: value, turma: null });
  const organizeStudent = (studentId: string): void => {
    if (!board) return;
    const row = board.placements.find((item) => item.studentId === studentId);
    setAction(
      row
        ? { kind: row.publishedAt ? "history" : "edit", row }
        : { kind: "newPlacement", studentId },
    );
  };
  return {
    params,
    semesters,
    query,
    semesterId,
    board,
    readOnly,
    selectedPlan,
    selectedRows,
    planForm,
    setPlanForm,
    semesterForm,
    setSemesterForm,
    action,
    setAction,
    selectPlan,
    selectSemester,
    selectView,
    organizeStudent,
  };
};

const useSemesterData = (selectedId: string | null): SemesterData => {
  const semesters = trpc.semesterOrganization.semesters.useQuery();
  const upcoming = [...(semesters.data ?? [])]
    .toReversed()
    .find((item) => dateOnly(item.startDate) > today());
  const semesterId = selectedId ?? upcoming?.id ?? semesters.data?.[0]?.id;
  const query = trpc.semesterOrganization.detail.useQuery(
    { semesterId: semesterId ?? "" },
    { enabled: Boolean(semesterId) },
  );
  return { semesters, semesterId, query };
};

function rowsForSelection({
  board,
  plan,
  id,
}: {
  board: SemesterBoard | undefined;
  plan: ClassPlan | undefined;
  id: string | null;
}): Placement[] {
  return (
    board?.placements.filter((row) =>
      id === "unassigned" ? !row.planId : row.planId === plan?.id,
    ) ?? []
  );
}
