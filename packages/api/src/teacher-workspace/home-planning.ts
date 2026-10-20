import type { StagePlanTarget } from "@lazuli/validators";
import { planningBand } from "@lazuli/domain";
import { planningContexts, readPlanning } from "../stage-planning/read.js";
import type { RecordContext } from "../class-records/data.js";

const DAY_MS = 86_400_000;
const DATE_LENGTH = 10;
export const HOME_WINDOW_DAYS = 7;
export const shiftHomeDate = (date: string, days: number): string =>
  new Date(new Date(date).getTime() + days * DAY_MS).toISOString().slice(0, DATE_LENGTH);

type Planning = Awaited<ReturnType<typeof readPlanning>>;
type PlanningNotice = {
  id: string;
  className: string;
  studentName: string | null;
  href: string;
};
type PacingNotice = PlanningNotice & {
  basis: "STEP" | "PAGE";
  reference: string | null;
  actual: number;
  expected: number;
  plannedOn: string;
  lastRecordedOn: string;
};
export type HomePlanning = {
  exams: Array<PlanningNotice & { title: string; date: string }>;
  pacing: PacingNotice[];
  unconfiguredPlans: number;
};

export async function homePlanning(
  context: RecordContext,
  { currentClassIds, today }: { currentClassIds: Set<string>; today: string },
): Promise<HomePlanning> {
  const contexts = await planningContexts(context);
  const groups = contexts.filter((row) => currentClassIds.has(row.id));
  const targets: StagePlanTarget[] = groups.flatMap((row) =>
    row.scheduleType === "REGULAR"
      ? [{ classId: row.id }]
      : row.students
          .filter((student) => !student.historical && student.startOn <= today)
          .map((student) => ({ classId: row.id, progressId: student.progressId })),
  );
  const plans = await Promise.all(targets.map((target) => readPlanning(context, target)));
  const through = shiftHomeDate(today, HOME_WINDOW_DAYS);
  return {
    exams: plans
      .flatMap((data) =>
        (data.plan?.items ?? [])
          .filter(
            (item) =>
              item.kind === "ASSESSMENT" && item.plannedOn >= today && item.plannedOn <= through,
          )
          .map((item) => ({
            id: item.id,
            title: item.title,
            date: item.plannedOn,
            className: data.scope.class.name,
            studentName: data.scope.student?.fullName ?? null,
            href: planningHref(data),
          })),
      )
      .toSorted(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.className.localeCompare(right.className, "pt-BR"),
      ),
    pacing: plans.flatMap((data) => pacingNotice(data, today)),
    unconfiguredPlans: plans.filter((data) => !data.plan).length,
  };
}

function planningHref(data: Planning): string {
  return data.scope.student
    ? `/professor/alunos/${data.scope.student.id}?secao=planejamento`
    : `/professor/turmas/${data.scope.class.id}?secao=planejamento`;
}

function pacingNotice(data: Planning, today: string): PacingNotice[] {
  const cutoff = shiftHomeDate(today, -HOME_WINDOW_DAYS);
  const latest = data.records[0];
  if (latest?.content.planItemId) {
    const band = planningBand(data.plan?.items ?? [], today, latest.content.planItemId);
    if (band.actual >= 0) {
      if (band.position !== "BEHIND") return [];
      const expected = band.items.findLastIndex((item) => item.plannedOn <= cutoff);
      const target = band.items[expected];
      if (!target || expected <= band.actual) return [];
      return [
        {
          id: `${data.plan!.id}:steps`,
          basis: "STEP",
          className: data.scope.class.name,
          studentName: data.scope.student?.fullName ?? null,
          reference: target.title,
          actual: band.actual + 1,
          expected: expected + 1,
          plannedOn: target.plannedOn,
          lastRecordedOn: latest.date,
          href: planningHref(data),
        },
      ];
    }
  }
  const due = (data.plan?.items ?? []).filter(
    (item) =>
      item.kind !== "ASSESSMENT" &&
      item.plannedOn <= cutoff &&
      (item.pageTo ?? item.pageFrom) !== null,
  );
  const references = [
    ...new Set(due.map((item) => item.reference?.trim().toLocaleLowerCase("pt-BR") ?? "")),
  ];
  return references.flatMap<PacingNotice>((reference) => {
    const items = due.filter(
      (item) => (item.reference?.trim().toLocaleLowerCase("pt-BR") ?? "") === reference,
    );
    const latest = data.records.find(
      (row) =>
        (row.content.reference?.trim().toLocaleLowerCase("pt-BR") ?? "") === reference &&
        (row.content.pageTo ?? row.content.pageFrom) !== null,
    );
    // Missing evidence is not evidence that a class is behind.
    if (!latest) return [];
    const actual = latest.content.pageTo ?? latest.content.pageFrom!;
    const unReached = items.filter((item) => (item.pageTo ?? item.pageFrom!) > actual);
    if (unReached.length === 0) return [];
    const target = unReached.toSorted(
      (left, right) => (right.pageTo ?? right.pageFrom!) - (left.pageTo ?? left.pageFrom!),
    )[0]!;
    const expected = target.pageTo ?? target.pageFrom!;
    return [
      {
        id: `${data.plan!.id}:${reference}`,
        basis: "PAGE",
        className: data.scope.class.name,
        studentName: data.scope.student?.fullName ?? null,
        reference: target.reference,
        actual,
        expected,
        plannedOn: target.plannedOn,
        lastRecordedOn: latest.date,
        href: planningHref(data),
      },
    ];
  });
}
