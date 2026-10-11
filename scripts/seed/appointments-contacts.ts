import { recordActivity } from "../../packages/api/src/activity/record.js";
import { addDays, isoOf, stableUuid } from "../../packages/db/src/seed-dev-support.js";
import {
  businessInstant,
  minutesAfter,
  nextWeekday,
  scenarioDate,
  type AppointmentSeedContext,
} from "./appointments-data.js";

const CONTACT_COUNTS = [1, 1, 1, 1, 2, 2, 3, 3];
const CHANNELS = ["WHATSAPP", "PHONE", "EMAIL", "IN_PERSON"];

/** Append-only contacts explain follow-up without sending messages or changing the original absence. */
export async function seedAppointmentContacts(context: AppointmentSeedContext): Promise<number> {
  const participants = await context.database.pedagogicalAppointment.findMany({
    where: { deletedAt: null },
    select: { studentId: true, date: true, status: true },
  });
  const rows = await context.database.attendance.findMany({
    where: {
      status: "ABSENT",
      deletedAt: null,
      enrollment: { studentId: { in: participants.map((row) => row.studentId) }, deletedAt: null },
      classSession: {
        deletedAt: null,
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        date: { lte: scenarioDate(context.todayIso, -10) },
      },
    },
    select: {
      id: true,
      classSession: { select: { date: true } },
      enrollment: {
        select: { studentId: true, student: { select: { fullName: true, guardianId: true } } },
      },
    },
    orderBy: [{ classSession: { date: "desc" } }, { id: "asc" }],
  });
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.enrollment.studentId)) return false;
    seen.add(row.enrollment.studentId);
    return true;
  });
  const minors = unique.filter((row) => row.enrollment.student.guardianId).slice(0, 4);
  const adults = unique.filter((row) => !row.enrollment.student.guardianId).slice(0, 4);
  const subjects = Array.from({ length: 4 }, (_, index) => [minors[index], adults[index]])
    .flat()
    .filter((row) => row !== undefined);
  let count = 0;
  for (const [index, source] of subjects.entries()) {
    for (let sequence = 0; sequence < CONTACT_COUNTS[index]!; sequence++) {
      const contactedOn = nextWeekday(addDays(source.classSession.date, 1 + sequence * 3));
      if (isoOf(contactedOn) >= context.todayIso) continue;
      const contactedAt = businessInstant(contactedOn, "10:00");
      const last = sequence === CONTACT_COUNTS[index]! - 1;
      const hasLaterAppointment = participants.some(
        (row) =>
          row.studentId === source.enrollment.studentId &&
          row.status !== "CANCELLED" &&
          row.date > contactedOn,
      );
      const channel = CHANNELS[(index + sequence) % CHANNELS.length]!;
      const outcome =
        last && hasLaterAppointment && index % 3 !== 0
          ? "APPOINTMENT_AGREED"
          : sequence === 0 && index % 2 === 0 && channel !== "IN_PERSON"
            ? "NO_ANSWER"
            : "REPLIED";
      const person = source.enrollment.student.guardianId ? "responsável" : "aluno";
      const notes =
        outcome === "NO_ANSWER"
          ? `Tentativa de contato com ${person} após a falta; retorno ainda não recebido.`
          : outcome === "APPOINTMENT_AGREED"
            ? `Contato com ${person}; confirmado o horário do atendimento e mantido o acompanhamento da frequência.`
            : `Retorno de ${person}; conversamos sobre a rotina e combinamos acompanhar os próximos encontros.`;
      const recordedAt = minutesAfter(contactedAt, 5);
      const id = stableUuid(["absence-contact", source.id, String(sequence)]);
      await context.database.absenceContact.create({
        data: {
          id,
          studentId: source.enrollment.studentId,
          attendanceId: source.id,
          actorId: context.admin.id,
          contactedAt,
          recordedAt,
          channel,
          outcome,
          notes,
          createdAt: recordedAt,
          updatedAt: recordedAt,
          nextContactDate:
            outcome === "APPOINTMENT_AGREED"
              ? null
              : last && index % 3 === 0
                ? nextWeekday(scenarioDate(context.todayIso, 3))
                : nextWeekday(addDays(contactedOn, 3)),
        },
      });
      await recordActivity(
        context.database,
        { staffUser: context.admin, now: recordedAt },
        "appointments.contact",
        {
          subject: {
            type: "student",
            id: source.enrollment.studentId,
            name: source.enrollment.student.fullName,
          },
          description: `${isoOf(source.classSession.date).split("-").reverse().join("/")} · ${notes}`,
          deduplicationKey: `seed-absence-contact/${id}`,
        },
      );
      count++;
    }
  }
  return count;
}
