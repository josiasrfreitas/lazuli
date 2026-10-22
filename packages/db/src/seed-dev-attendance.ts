import { endOfDayUtc, isoOf, stableUuid, utcDate, type SeedContext } from "./seed-dev-support.js";

const MAKEUP_LIMIT = 5;
const PENDING_MAKEUPS = 3;
const SOURCE_CLASS_KEY = "E1A";
const TARGET_CLASS_KEY = "E1B";

type MakeupInput = {
  originEnrollmentId: string;
  absenceDate: Date;
  target: { id: string; date: Date };
  pending: boolean;
};

/** These classes share a stage and meet on different days, allowing real makeups. */
export async function seedMakeups(context: SeedContext): Promise<void> {
  const absent = await context.database.attendance.findMany({
    where: { status: "ABSENT", enrollment: { classId: stableUuid(["class", SOURCE_CLASS_KEY]) } },
    include: { classSession: true },
    orderBy: { classSession: { date: "desc" } },
  });
  const seen = new Set<string>();
  for (const row of absent) {
    if (seen.has(row.enrollmentId) || seen.size >= MAKEUP_LIMIT) continue;
    const pending = seen.size < PENDING_MAKEUPS;
    const target = await makeupTarget(context, { absenceDate: row.classSession.date, pending });
    if (!target) continue;
    seen.add(row.enrollmentId);
    await createMakeup(context, {
      originEnrollmentId: row.enrollmentId,
      absenceDate: row.classSession.date,
      target,
      pending,
    });
  }
}

async function makeupTarget(
  context: SeedContext,
  input: {
    absenceDate: Date;
    pending: boolean;
  },
): Promise<{ id: string; date: Date } | null> {
  return context.database.classSession.findFirst({
    where: {
      classId: stableUuid(["class", TARGET_CLASS_KEY]),
      status: "SCHEDULED",
      date: input.pending
        ? { gt: utcDate(context.todayIso) }
        : { gt: input.absenceDate, lt: utcDate(context.todayIso) },
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true },
  });
}

async function createMakeup(context: SeedContext, input: MakeupInput): Promise<void> {
  await context.database.makeup.create({
    data: {
      id: stableUuid(["makeup", input.originEnrollmentId, input.target.id]),
      originEnrollmentId: input.originEnrollmentId,
      targetClassSessionId: input.target.id,
      scheduledAt: endOfDayUtc(isoOf(input.absenceDate)),
      scheduledById: context.adminId,
      reason: `Reposição da ausência de ${isoOf(input.absenceDate)}; horário acordado com a família.`,
      attendedAt: input.pending ? null : endOfDayUtc(isoOf(input.target.date)),
      attendedById: input.pending ? null : context.classes.get(TARGET_CLASS_KEY)!.teacherId,
    },
  });
}
