import { academicActivityCanBeCancelled } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { lockTeacher } from "../teachers/availability.js";
import { lockClassRecord } from "../class-records/data.js";
import { recordActivity } from "../activity/record.js";
import { dateOnly, type PlanningContext } from "./data.js";
import { adjustmentFingerprint, adjustmentPlanning, saveAdjustedProjection } from "./adjustment-data.js";
import type { EndClassesInput } from "./adjustment-schema.js";

const evidence = {
  classRecord: { select: { id: true } },
  _count: { select: { attendanceRows: true, attendanceWindows: true, attendanceDeclarations: true, appointments: true, entryVisits: true } },
} as const;
export async function previewEndClasses(context: PlanningContext, input: EndClassesInput) {
  const { data, remainingMinutes, uncertain } = await adjustmentPlanning(context, input.classId);
  if (input.lastDate < data.scope.today) throw badRequest("A última aula deve ser hoje ou em uma data futura.");
  const sessions = await context.database.classSession.findMany({ where: {
    classId: input.classId, date: { gt: new Date(input.lastDate) }, deletedAt: null, status: "SCHEDULED",
  }, include: evidence, orderBy: [{ date: "asc" }, { id: "asc" }] });
  const cancellable = sessions.filter((row) => academicActivityCanBeCancelled({ ...row, now: context.now,
    recorded: Boolean(row.classRecord || row.attendanceConfirmedAt || row.attendanceLastCommittedAt || row.portalSubmittedAt || Object.values(row._count).some(Boolean)),
  }));
  const availableMinutes = data.availableSessions.filter((row) => row.date <= input.lastDate).reduce((sum, row) => sum + row.minutes, 0);
  const blocked = uncertain ? "Confira os registros e a duração dos conteúdos antes de antecipar o encerramento."
    : availableMinutes < remainingMinutes ? `Ainda faltariam ${(remainingMinutes - availableMinutes) / 60}h para acomodar o conteúdo até essa data.`
    : cancellable.length === 0 ? "Não há aulas futuras sem registros para cancelar depois dessa data." : null;
  return {
    count: cancellable.length, preserved: sessions.length - cancellable.length,
    from: cancellable[0] ? dateOnly(cancellable[0].date) : null,
    through: cancellable.at(-1) ? dateOnly(cancellable.at(-1)!.date) : null,
    remainingMinutes, availableMinutes, blocked,
    confirmation: `CONFIRMO O CANCELAMENTO DE ${cancellable.length} AULAS`,
    fingerprint: adjustmentFingerprint({ input, plan: data.plan?.version, records: data.records, sessions }),
    sessionIds: cancellable.map((row) => row.id),
  };
}
export async function endClasses(context: PlanningContext, input: EndClassesInput & { fingerprint: string; confirmation: string }) {
  await lockTeacher(context.database, "");
  const request = { classId: input.classId, lastDate: input.lastDate, reason: input.reason };
  const initial = await previewEndClasses(context, request);
  for (const id of initial.sessionIds) await lockClassRecord(context.database, id);
  const preview = await previewEndClasses(context, request);
  if (preview.blocked) throw badRequest(preview.blocked);
  if (preview.fingerprint !== input.fingerprint) throw badRequest("As aulas ou o planejamento mudaram. Confira os impactos novamente.");
  if (input.confirmation.trim().toLocaleUpperCase("pt-BR") !== preview.confirmation)
    throw badRequest("Digite a confirmação completa para cancelar as aulas.");
  await context.database.classSession.updateMany({ where: { id: { in: preview.sessionIds }, status: "SCHEDULED" }, data: {
    status: "CANCELLED", cancelReason: input.reason, cancelledAt: context.now, cancelledById: context.staffUser.id,
  } });
  const row = await context.database.class.findUniqueOrThrow({ where: { id: input.classId }, select: { portalClassName: true } });
  await recordActivity(context.database, { context, action: "planning.endClasses", details: {
    subject: { type: "class", id: input.classId, name: row.portalClassName },
    description: `Última aula em ${input.lastDate}. ${preview.count} aulas canceladas; ${preview.preserved} preservadas. ${input.reason}`,
  } });
  await saveAdjustedProjection(context, input.classId, input.reason);
  return { cancelled: preview.count };
}
