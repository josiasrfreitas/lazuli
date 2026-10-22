"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useQueryState, parseAsString } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { OrganizationAction, SemesterBoard } from "./model";

type Setter<T> = Dispatch<SetStateAction<T>>;
type SemesterData = {
  periods: QueryResult<RouterOutputs["semesterOrganization"]["semesters"]>;
  query: QueryResult<SemesterBoard>;
  semesterId: string;
  today: string;
};
export type OrganizationPageModel = SemesterData & {
  board: SemesterBoard | undefined;
  ended: boolean;
  tab: string;
  setTab: (value: string) => void;
  search: string;
  setSearch: Setter<string>;
  classSearch: string;
  setClassSearch: Setter<string>;
  showClosed: boolean;
  setShowClosed: Setter<boolean>;
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
    error: { message: string } | null;
    reset: () => void;
    mutate: (input: { semesterId: string }) => void;
  };
  selectPeriod: (id: string) => void;
};

type PageControls = Pick<
  OrganizationPageModel,
  | "tab"
  | "setTab"
  | "search"
  | "setSearch"
  | "classSearch"
  | "setClassSearch"
  | "showClosed"
  | "setShowClosed"
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
  const board = data.query.data;
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
  const [search, setSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  function selectPeriod(id: string): void {
    void setSelectedPeriod(id);
    setPlanId(null);
    setAction(null);
    setFeedback("");
    setClassSearch("");
  }
  const setTab = (value: string): void => void setTabState(value);
  return {
    selectedPeriod,
    tab,
    setTab,
    search,
    setSearch,
    classSearch,
    setClassSearch,
    showClosed,
    setShowClosed,
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
    { enabled: Boolean(semesterId) },
  );
  return { periods, query, semesterId, today };
}

function resolveSemesterId({
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
  return (
    selectedPeriod ||
    current?.id ||
    periods.find((period) => dateOnly(period.endDate) >= today)?.id ||
    periods[0]?.id ||
    ""
  );
}
