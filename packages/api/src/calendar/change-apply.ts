import type { Prisma } from "@lazuli/db";
import type { CalendarChange } from "./change-schema.js";
import { calendarChangeState, type CalendarChangeState } from "./change-state.js";
import { civil, datesBetween, day } from "./change-dates.js";
type ChangeInput = { change: CalendarChange; actorId: string; now: Date };
type AppliedChange = {
  semesterId: string | null;
  reason: string;
  fromDate: Date;
  throughDate: Date;
};
export async function applyCalendarChange(
  database: Prisma.TransactionClient,
  input: ChangeInput,
): Promise<AppliedChange> {
  const { change, actorId, now } = input;
  const state = await calendarChangeState(database, change);
  const semesterId = await persistCalendarChange(database, input);
  if (change.action !== "period") await reconcileClosedDays(database, { state, actorId, now });
  return {
    semesterId,
    reason: changeReason(change, state),
    fromDate: day(state.from),
    throughDate: day(state.through),
  };
}
async function persistCalendarChange(
  database: Prisma.TransactionClient,
  input: ChangeInput,
): Promise<string | null> {
  const { change, actorId, now } = input;
  switch (change.action) {
    case "period": {
      const data = { name: change.name, startDate: day(change.from), endDate: day(change.through) };
      const period = change.id
        ? await database.period.update({ where: { id: change.id }, data })
        : await database.period.create({ data });
      return period.id;
    }
    case "interruption": {
      const data = {
        title: change.title,
        description: change.description,
        kind: change.kind,
        fromDate: day(change.from),
        throughDate: day(change.through),
      };
      await (change.id
        ? database.academicInterruption.update({ where: { id: change.id }, data })
        : database.academicInterruption.create({ data: { ...data, createdById: actorId } }));
      break;
    }
    case "removeInterruption": {
      await database.academicInterruption.update({
        where: { id: change.id },
        data: { deletedAt: now, sourceKey: null },
      });
      break;
    }
    case "holidays": {
      for (const item of change.dates)
        await database.academicInterruption.upsert({
          where: { sourceKey: item.sourceKey },
          update: {},
          create: {
            title: item.title,
            kind: "HOLIDAY",
            fromDate: day(item.date),
            throughDate: day(item.date),
            sourceKey: item.sourceKey,
            createdById: actorId,
          },
        });
      break;
    }
  }
  return null;
}
async function reconcileClosedDays(
  database: Prisma.TransactionClient,
  input: { state: CalendarChangeState; actorId: string; now: Date },
): Promise<void> {
  const { state, actorId, now } = input;
  // A union projection keeps overlapping interruptions and pre-existing manual dates intact.
  const interruptions = await database.academicInterruption.findMany({
    where: {
      deletedAt: null,
      fromDate: { lte: day(state.through) },
      throughDate: { gte: day(state.from) },
    },
  });
  const unmanaged = new Set(
    state.closedDays.filter((row) => !row.calendarManaged).map((row) => civil(row.date)),
  );
  for (const date of datesBetween(state.from, state.through)) {
    if (unmanaged.has(date)) continue;
    const applicable = interruptions.filter(
      (row) => civil(row.fromDate) <= date && civil(row.throughDate) >= date,
    );
    await (applicable.length > 0
      ? database.schoolClosedDay.upsert({
          where: { date: day(date) },
          create: {
            date: day(date),
            reason: applicable.map((row) => row.title).join(" · "),
            calendarManaged: true,
            createdById: actorId,
          },
          update: {
            deletedAt: null,
            reason: applicable.map((row) => row.title).join(" · "),
            calendarManaged: true,
          },
        })
      : database.schoolClosedDay.updateMany({
          where: { date: day(date), calendarManaged: true, deletedAt: null },
          data: { deletedAt: now },
        }));
  }
}
function changeReason(change: CalendarChange, state: CalendarChangeState): string {
  switch (change.action) {
    case "period": {
      return `Limites do semestre · ${change.name}`;
    }
    case "interruption": {
      return change.title;
    }
    case "removeInterruption": {
      return `Remoção · ${state.interruption!.title}`;
    }
    case "holidays": {
      return "Feriados do calendário acadêmico";
    }
  }
}
