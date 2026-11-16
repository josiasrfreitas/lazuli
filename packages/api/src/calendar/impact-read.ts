import type { Prisma } from "@lazuli/db";
import { day } from "./change-dates.js";
import type { CalendarChangeState } from "./change-state.js";
const sessionInclude = {
  class: { select: { id: true, portalClassName: true, semesterId: true } },
  classRecord: { select: { id: true } },
  _count: {
    select: { attendanceRows: true, attendanceDeclarations: true, attendanceWindows: true },
  },
} as const;
const appointmentInclude = {
  student: { select: { fullName: true } },
  targetClassSession: { select: { class: { select: { semesterId: true } } } },
} as const;
const visitInclude = {
  candidate: { select: { fullName: true } },
  class: { select: { semesterId: true } },
  assessment: { select: { visitId: true } },
} as const;
const planInclude = {
  plan: {
    select: {
      classId: true,
      class: { select: { portalClassName: true, semesterId: true } },
      student: { select: { fullName: true } },
    },
  },
} as const;
export type ImpactSession = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;
export type ImpactAppointment = Prisma.PedagogicalAppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;
export type ImpactVisit = Prisma.EntryVisitGetPayload<{ include: typeof visitInclude }>;
export type ImpactPlan = Prisma.StagePlanItemGetPayload<{ include: typeof planInclude }>;
export type ImpactRows = {
  sessions: ImpactSession[];
  appointments: ImpactAppointment[];
  visits: ImpactVisit[];
  plannedItems: ImpactPlan[];
};
export async function readCalendarImpact(
  database: Prisma.TransactionClient,
  state: CalendarChangeState,
): Promise<[ImpactSession[], ImpactAppointment[], ImpactVisit[], ImpactPlan[]]> {
  const range = { gte: day(state.from), lte: day(state.through) };
  return Promise.all([
    database.classSession.findMany({
      where: {
        deletedAt: null,
        date: range,
        ...(state.period ? { class: { semesterId: state.period.id } } : {}),
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: sessionInclude,
    }),
    database.pedagogicalAppointment.findMany({
      where: { deletedAt: null, date: range },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: appointmentInclude,
    }),
    database.entryVisit.findMany({
      where: { deletedAt: null, date: range },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: visitInclude,
    }),
    database.stagePlanItem.findMany({
      where: {
        deletedAt: null,
        plannedOn: range,
        plan: {
          deletedAt: null,
          ...(state.period ? { class: { semesterId: state.period.id } } : {}),
        },
      },
      orderBy: [{ plannedOn: "asc" }, { id: "asc" }],
      include: planInclude,
    }),
  ]);
}
