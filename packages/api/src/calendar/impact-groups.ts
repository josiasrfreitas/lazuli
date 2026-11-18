import type { Prisma } from "@lazuli/db";
import { evidenceSessionTeacher } from "@lazuli/db/appointment-evidence";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import type { calendarCapacity } from "./capacity.js";
import type { ImpactCandidates } from "./impact-selection.js";
import { civil, day } from "./change-dates.js";

export type ImpactClassSummary = {
  classId: string;
  name: string;
  stageName: string | null;
  scheduleType: "REGULAR" | "PERSONALIZED";
  periodName: string;
  from: string;
  through: string;
  lessons: number;
  planItems: number;
  deficitMinutes: number | null;
  availableMinutes: number;
  requiredMinutes: number | null;
};
export type TeacherImpact = {
  teacherId: string | null;
  name: string;
  classes: ImpactClassSummary[];
};
type Capacity = Awaited<ReturnType<typeof calendarCapacity>>;

/** One compact class summary per responsible teacher, retaining dated substitutions. */
export async function groupCalendarImpact(
  database: Prisma.TransactionClient,
  input: { candidates: ImpactCandidates; capacity: Capacity; from: string; through: string },
): Promise<TeacherImpact[]> {
  const { candidates, capacity } = input;
  const ids = new Set([
    ...candidates.cancellableSessions.map((row) => row.classId),
    ...candidates.plans.flatMap((row) => (row.plan.classId ? [row.plan.classId] : [])),
    ...capacity.filter((row) => (row.deficitMinutes ?? 0) > 0).map((row) => row.classId),
  ]);
  if (!ids.size) return [];
  const rows = await database.class.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: {
      id: true,
      portalClassName: true,
      scheduleType: true,
      sharedStage: { select: { name: true } },
      semester: { select: { name: true } },
      ...responsibilitySelect,
    },
  });
  const classes = new Map(rows.map((row) => [row.id, row]));
  const capacities = new Map(capacity.map((row) => [row.classId, row]));
  const groups = new Map<
    string,
    { teacherId: string | null; name: string; classes: Map<string, ImpactClassSummary> }
  >();
  function entry(classId: string, date: Date, teacher?: { id: string; name: string } | null) {
    const row = classes.get(classId);
    if (!row) return null;
    const responsible = teacher === undefined ? usualTeacherOn(row, date) : teacher;
    const key = responsible?.id ?? "unassigned";
    let group = groups.get(key);
    if (!group) {
      group = {
        teacherId: responsible?.id ?? null,
        name: responsible?.name ?? "Sem professor definido",
        classes: new Map(),
      };
      groups.set(key, group);
    }
    let summary = group.classes.get(classId);
    const dateOnly = civil(date);
    if (!summary) {
      const load = capacities.get(classId);
      summary = {
        classId,
        name: row.portalClassName,
        stageName: row.sharedStage?.name ?? null,
        scheduleType: row.scheduleType,
        periodName: row.semester.name,
        from: dateOnly,
        through: dateOnly,
        lessons: 0,
        planItems: 0,
        deficitMinutes: load?.deficitMinutes ?? null,
        availableMinutes: load?.availableMinutes ?? 0,
        requiredMinutes: load?.requiredMinutes ?? null,
      };
      group.classes.set(classId, summary);
    }
    summary.from = summary.from < dateOnly ? summary.from : dateOnly;
    summary.through = summary.through > dateOnly ? summary.through : dateOnly;
    return summary;
  }
  for (const session of candidates.cancellableSessions) {
    const summary = entry(session.classId, session.date, evidenceSessionTeacher(session));
    if (summary) summary.lessons += 1;
  }
  for (const item of candidates.plans) {
    if (!item.plan.classId) continue;
    const summary = entry(item.plan.classId, item.plannedOn);
    if (summary) summary.planItems += 1;
  }
  for (const load of capacity.filter((row) => (row.deficitMinutes ?? 0) > 0)) {
    if ([...groups.values()].some((group) => group.classes.has(load.classId))) continue;
    const summary = entry(load.classId, day(input.from));
    if (summary) summary.through = input.through;
  }
  return [...groups.values()]
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
    .map((group) => ({
      teacherId: group.teacherId,
      name: group.name,
      classes: [...group.classes.values()].sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR"),
      ),
    }));
}
