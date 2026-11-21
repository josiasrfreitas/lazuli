"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useQueryState, parseAsString } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type ClientError, type QueryResult } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationAction, OrganizationBoard } from "./model";

type Setter<T> = Dispatch<SetStateAction<T>>;
type SemesterData = {
  periods: QueryResult<RouterOutputs["semesterOrganization"]["semesters"]>;
  query: QueryResult<OrganizationBoard>;
  semesterId: string;
  today: string;
};
export type OrganizationPageModel = SemesterData & {
  selectedPeriod: string;
  board: OrganizationBoard | undefined;
  ended: boolean;
  tab: string;
  setTab: (value: string) => void;
  planId: string | null;
  setPlanId: Setter<string | null>;
  action: OrganizationAction | null;
  setAction: Setter<OrganizationAction | null>;
  feedback: string;
  setFeedback: Setter<string>;
  setupOpen: boolean;
  setSetupOpen: Setter<boolean>;
  prepare: {
    isPending: boolean;
    error: ClientError | null;
    variables: { semesterId: string } | undefined;
    mutate: (input: { semesterId: string }) => void;
  };
  selectPeriod: (id: string) => void;
};

type PageControls = Pick<
  OrganizationPageModel,
  | "tab"
  | "setTab"
  | "planId"
  | "setPlanId"
  | "action"
  | "setAction"
  | "feedback"
  | "setFeedback"
  | "setupOpen"
  | "setSetupOpen"
  | "selectPeriod"
> & { selectedPeriod: string };

export function useOrganizationPageModel(): OrganizationPageModel {
  const controls = usePageControls();
  const data = useSemesterData(controls.selectedPeriod);
  const board = data.semesterId ? data.query.data : undefined;
  const prepare = usePrepare(controls.setFeedback);
  return {
    ...controls,
    ...data,
    board,
    ended: board ? dateOnly(board.semester.endDate) < data.today : false,
    prepare,
  };
}

function usePageControls(): PageControls {
  const [selectedPeriod, setSelectedPeriod] = useQueryState(
    "semestre",
    parseAsString.withDefault(""),
  );
  const [tab, setTabState] = useQueryState("visao", parseAsString.withDefault("agenda"));
  const [planId, setPlanQuery] = useQueryState("turma", parseAsString);
  const setPlanId: Setter<string | null> = (value) => {
    void setPlanQuery(value);
  };
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  function selectPeriod(id: string): void {
    void setSelectedPeriod(id);
    setPlanId(null);
    setAction(null);
    setFeedback("");
  }
  const setTab = (value: string): void => void setTabState(value);
  return {
    selectedPeriod,
    tab,
    setTab,
    planId,
    setPlanId,
    action,
    setAction,
    feedback,
    setFeedback,
    setupOpen,
    setSetupOpen,
    selectPeriod,
  };
}

function usePrepare(setFeedback: Setter<string>): OrganizationPageModel["prepare"] {
  const refresh = useOrganizationRefresh();
  return trpc.semesterOrganization.prepare.useMutation({
    onSuccess: async (result) => {
      await refresh();
      setFeedback(
        `Base incorporada: ${result.plans} turmas e ${result.students} alunos. Ajustes anteriores preservados.`,
      );
    },
  });
}

function useSemesterData(selectedPeriod: string): SemesterData {
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const today = toDateOnlySaoPaulo(new Date());
  const semesterId = resolveSemesterId({ selectedPeriod, periods: periods.data ?? [], today });
  const query = trpc.semesterOrganization.detail.useQuery(
    { semesterId },
    { enabled: Boolean(semesterId), placeholderData: (previous) => previous },
  );
  return { periods, query, semesterId, today };
}

export function resolveSemesterId({
  selectedPeriod,
  periods,
  today,
}: {
  selectedPeriod: string;
  periods: RouterOutputs["semesterOrganization"]["semesters"];
  today: string;
}): string {
  const current = periods.find(
    (period) => dateOnly(period.startDate) <= today && dateOnly(period.endDate) >= today,
  );
  const period =
    selectedPeriod === "proximo"
      ? periods.findLast((candidate) => dateOnly(candidate.startDate) > today)
      : (periods.find((candidate) => candidate.id === selectedPeriod) ??
        current ??
        periods.findLast((candidate) => dateOnly(candidate.endDate) >= today) ??
        periods[0]);
  return period?.id ?? "";
}
