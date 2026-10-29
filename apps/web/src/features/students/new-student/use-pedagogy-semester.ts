import { useEffect } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { trpc, type QueryResult } from "~/lib/trpc";
import { dateOnly } from "~/features/class-organization/shared";
import type { PedagogyDraft } from "./pedagogy-step";

type SemesterList = RouterOutputs["semesterOrganization"]["semesters"];
type SemesterQuery = QueryResult<SemesterList>;
type Semester = SemesterList[number];

export type PedagogySemester = {
  periods: SemesterQuery;
  current: Semester | undefined;
  next: Semester | undefined;
  currentId: string | undefined;
  nextId: string | undefined;
};

export function usePedagogySemester(
  draft: PedagogyDraft,
  onChange: (draft: PedagogyDraft) => void,
): PedagogySemester {
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const today = toDateOnlySaoPaulo(new Date());
  const availablePeriods = [...(periods.data ?? [])]
    .filter((period) => !period.deletedAt)
    .toSorted((left, right) => dateOnly(left.startDate).localeCompare(dateOnly(right.startDate)));
  const current = availablePeriods.find(
    (period) => dateOnly(period.startDate) <= today && dateOnly(period.endDate) >= today,
  );
  const next = availablePeriods.find((period) => dateOnly(period.startDate) > today);
  const currentId = current?.id;
  const nextId = next?.id;
  useEffect(() => {
    if (!periods.data || draft.semesterId === currentId) return;
    const semesterId = currentId ?? "";
    if (draft.semesterId !== semesterId) onChange({ ...draft, semesterId });
  }, [periods.data, currentId, nextId, draft, onChange]);
  return { periods, current, next, currentId, nextId };
}
