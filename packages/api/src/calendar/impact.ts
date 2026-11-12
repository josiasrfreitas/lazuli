import { calendarCapacity } from "./capacity.js";
import { createHash } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { academicActivityCanBeCancelled } from "@lazuli/domain";
import { calendarChangeState, civil, day } from "./change-state.js";
import type { CalendarChange } from "./change-schema.js";

export async function previewCalendarChange(
  database: Prisma.TransactionClient,
  change: CalendarChange,
  now: Date,
) {
  const state = await calendarChangeState(database, change);
  const range = { gte: day(state.from), lte: day(state.through) };
  const [sessions, appointments, visits, plannedItems] = await Promise.all([
    database.classSession.findMany({
      where: {
        deletedAt: null,
        date: range,
        ...(state.period ? { class: { semesterId: state.period.id } } : {}),
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        class: { select: { id: true, portalClassName: true, semesterId: true } },
        classRecord: { select: { id: true } },
        _count: {
          select: { attendanceRows: true, attendanceDeclarations: true, attendanceWindows: true },
        },
      },
    }),
    database.pedagogicalAppointment.findMany({
      where: { deletedAt: null, date: range },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        student: { select: { fullName: true } },
        targetClassSession: { select: { class: { select: { semesterId: true } } } },
      },
    }),
    database.entryVisit.findMany({
      where: { deletedAt: null, date: range },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        candidate: { select: { fullName: true } },
        class: { select: { semesterId: true } },
        assessment: { select: { visitId: true } },
      },
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
      include: {
        plan: {
          select: {
            classId: true,
            class: { select: { portalClassName: true, semesterId: true } },
            student: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);
  const outside = (semesterId: string, date: Date) =>
    !state.proposedPeriods.some(
      (period) => period.id === semesterId && period.startDate <= date && period.endDate >= date,
    );
  const affectedSession = (row: (typeof sessions)[number]) =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.class.semesterId === change.id &&
      outside(row.class.semesterId, row.date));
  const affectedAppointment = (row: (typeof appointments)[number]) =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.targetClassSession?.class.semesterId === change.id &&
      outside(row.targetClassSession.class.semesterId, row.date));
  const affectedVisit = (row: (typeof visits)[number]) =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.class?.semesterId === change.id &&
      outside(row.class.semesterId, row.date)) ||
    (change.action === "period" &&
      !row.class &&
      !state.proposedPeriods.some(
        (period) => period.startDate <= row.date && period.endDate >= row.date,
      ));
  const sessionCandidates = sessions.filter(affectedSession);
  const appointmentCandidates = appointments.filter(affectedAppointment);
  const visitCandidates = visits.filter(affectedVisit);
  const cancellableSessions = sessionCandidates.filter((row) =>
    academicActivityCanBeCancelled({
      ...row,
      recorded: Boolean(
        row.classRecord ||
        row.attendanceConfirmedAt ||
        row.attendanceLastCommittedAt ||
        row.portalSubmittedAt ||
        row._count.attendanceRows ||
        row._count.attendanceDeclarations ||
        row._count.attendanceWindows,
      ),
      now,
    }),
  );
  const cancellableAppointments = appointmentCandidates.filter((row) =>
    academicActivityCanBeCancelled({
      ...row,
      recorded: Boolean(row.recordedAt || row.performedContent || row.performedMinutes),
      now,
    }),
  );
  const cancellableVisits = visitCandidates.filter((row) =>
    academicActivityCanBeCancelled({ ...row, recorded: Boolean(row.assessment), now }),
  );
  const plans = plannedItems.filter(
    (row) =>
      state.closed.has(civil(row.plannedOn)) ||
      (change.action === "period" &&
        row.plan.class?.semesterId === change.id &&
        outside(row.plan.class.semesterId, row.plannedOn)),
  );
  const capacity = await calendarCapacity(database, state);
  const evidence = {
    capacity,
    change,
    state: {
      periods: state.periods,
      interruptions: state.interruptions,
      closedDays: state.closedDays,
    },
    sessions: sessions.map((row) => [row.id, row.updatedAt, row._count, row.classRecord]),
    appointments: appointments.map((row) => [row.id, row.updatedAt, row.version]),
    visits: visits.map((row) => [row.id, row.updatedAt, row.assessment]),
    plans: plannedItems.map((row) => [row.id, row.updatedAt]),
    eligible: [
      cancellableSessions.map((row) => row.id),
      cancellableAppointments.map((row) => row.id),
      cancellableVisits.map((row) => row.id),
    ],
  };
  const entry = (
    row: { id: string; date: Date; startTime: Date; endTime: Date },
    name: string,
  ) => ({
    id: row.id,
    date: civil(row.date),
    startTime: row.startTime.toISOString().slice(11, 16),
    endTime: row.endTime.toISOString().slice(11, 16),
    name,
  });
  const releasedDates = state.closedDays
    .filter(
      (row) =>
        civil(row.date) >= state.from &&
        civil(row.date) <= state.through &&
        !state.closed.has(civil(row.date)),
    )
    .map((row) => civil(row.date));
  return {
    subject:
      change.action === "period"
        ? change.name
        : change.action === "interruption"
          ? change.title
          : change.action === "removeInterruption"
            ? state.interruption!.title
            : `${change.dates.length} feriados selecionados`,
    fingerprint: createHash("sha256").update(JSON.stringify(evidence)).digest("hex"),
    from: state.from,
    through: state.through,
    sessions: cancellableSessions.map((row) => ({
      ...entry(row, row.class.portalClassName),
      classId: row.classId,
    })),
    appointments: cancellableAppointments.map((row) => entry(row, row.student.fullName)),
    visits: cancellableVisits.map((row) => entry(row, row.candidate.fullName)),
    preserved:
      sessionCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableSessions.length +
      appointmentCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableAppointments.length +
      visitCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableVisits.length,
    plans: plans.map((row) => ({
      id: row.id,
      title: row.title,
      date: civil(row.plannedOn),
      classId: row.plan.classId,
      name: row.plan.class?.portalClassName ?? row.plan.student?.fullName ?? "Plano individual",
    })),
    releasedDates,
    capacity,
  };
}
