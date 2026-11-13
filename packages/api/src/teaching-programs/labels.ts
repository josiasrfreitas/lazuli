import type { Prisma } from "@lazuli/db";
import { programActivityLabels } from "@lazuli/domain";
export type ActivityContext = {
  title: string;
  sequence: number;
  durationMinutes: number;
  unit: { id: string; sequence: number; title: string };
  lessons: { id: string; sequence: number; title: string; part: string }[];
};
export async function readActivityContexts(
  database: Prisma.TransactionClient,
  activityIds: string[],
): Promise<Map<string, ActivityContext>> {
  if (!activityIds.length) return new Map();
  const selected = await database.programActivity.findMany({
    where: { id: { in: activityIds }, deletedAt: {} },
    select: { programId: true },
  });
  const activities = await database.programActivity.findMany({
    where: { programId: { in: [...new Set(selected.map((a) => a.programId))] }, deletedAt: null },
    include: { unit: true, lessons: { where: { deletedAt: null }, include: { lesson: true } } },
    orderBy: { sequence: "asc" },
  });
  const result = new Map<string, ActivityContext>();
  for (const programId of new Set(activities.map((a) => a.programId))) {
    const source = activities.filter((a) => a.programId === programId);
    const labels = programActivityLabels(source);
    for (const item of source)
      result.set(item.id, {
        title: labels.get(item.id) ?? item.title,
        sequence: item.sequence,
        durationMinutes: item.durationMinutes,
        unit: { id: item.unit.id, sequence: item.unit.sequence, title: item.unit.title },
        lessons: item.lessons.map(({ lesson, part }) => ({
          id: lesson.id,
          sequence: lesson.sequence,
          title: lesson.title,
          part,
        })),
      });
  }
  return result;
}
export async function readActivityLabels(
  database: Prisma.TransactionClient,
  ids: string[],
): Promise<Map<string, string>> {
  return new Map(
    [...(await readActivityContexts(database, ids))].map(([id, item]) => [id, item.title]),
  );
}
