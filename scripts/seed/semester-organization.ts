import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { addDays, isoOf, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { classScheduleSlotsInputSchema } from "../../packages/validators/src/class.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { readSemester } from "../../packages/api/src/semester-organization/queries.js";
import type { OrganizationContext } from "../../packages/api/src/semester-organization/data.js";
import {
  ORGANIZATION_GROUPS,
  availabilityProfile,
  availabilitySlots,
  organizationId,
  organizationInstant,
  type OrganizationGroup,
} from "./semester-organization-data.js";
import {
  placementSubject,
  proposalNotes,
  sourceCanPublish,
} from "./semester-organization-sources.js";
import {
  placementRevision,
  publishOrganizationStudent,
  recordOrganizationProposal,
} from "./semester-organization-history.js";
import {
  organizationSemester,
  publishedOrganizationClass,
} from "./semester-organization-calendar.js";

/** Only the coordinated, destructive pnpm seed invokes this loader; current schooling is preserved. */
export async function seedSemesterOrganization(
  database: DatabaseClient,
  todayIso: string,
): Promise<void> {
  const staffUser = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: { id: true, name: true, email: true, role: true, isEnabled: true },
  });
  const dates = {
    planned: organizationInstant(todayIso, 14),
    availability: organizationInstant(todayIso, 7),
    proposed: organizationInstant(todayIso, 6),
    revised: organizationInstant(todayIso, 4),
    published: organizationInstant(todayIso, 2),
  };
  const semester = await organizationSemester(database, dates.planned, staffUser.id);
  await recordActivity(database, { staffUser, now: dates.planned }, "calendar.createSemester", {
    subject: { type: "school", name: "Calendário escolar" },
    description: `Semestre ${semester.name}: ${isoOf(semester.startDate)} a ${isoOf(semester.endDate)}.`,
    deduplicationKey: `seed/semester-window/${semester.name}`,
  });
  const teachers = new Map<string, string>();
  for (const fixture of DEV_TEACHERS) {
    const teacher = await database.user.findUniqueOrThrow({
      where: { email: fixture.email },
      select: { id: true },
    });
    teachers.set(fixture.key, teacher.id);
  }
  const entries: { index: number; group: OrganizationGroup | null }[] = ORGANIZATION_GROUPS.flatMap(
    (group) => [...group.published, ...group.pending].map((index) => ({ index, group })),
  );
  entries.push({ index: 75, group: null });
  if (entries.length !== 32 || new Set(entries.map((row) => row.index)).size !== 32)
    throw new Error("Semester organization requires 32 distinct existing student fixtures.");
  const subjects = new Map<number, Awaited<ReturnType<typeof placementSubject>>>();
  for (const { index, group } of entries)
    subjects.set(index, await placementSubject(database, index, group));

  for (const group of ORGANIZATION_GROUPS) {
    classScheduleSlotsInputSchema.parse(group.slots);
    const stageId =
      group.scheduleType === "REGULAR"
        ? subjects.get([...group.published, ...group.pending][0]!)!.stage!.id
        : null;
    const planId = organizationId("plan", { semesterName: semester.name, key: group.key });
    await database.semesterClassPlan.create({
      data: {
        id: planId,
        semesterId: semester.id,
        name: group.name,
        scheduleType: group.scheduleType,
        format: group.format,
        sharedStageId: stageId,
        teacherId: group.teacherKey ? teachers.get(group.teacherKey)! : null,
        slots: group.slots,
        version: 1,
        recordedById: staffUser.id,
        createdAt: dates.planned,
        updatedAt: dates.planned,
      },
    });
    await recordActivity(
      database,
      { staffUser, now: dates.planned },
      "semesterOrganization.savePlan",
      {
        subject: { type: "school", name: "Organização do próximo semestre" },
        description: `${group.name} planejada para ${semester.name}; 120 minutos por semana.`,
        deduplicationKey: `seed/semester-plan/${planId}`,
      },
    );
  }

  for (const { index, group } of entries) {
    const subject = subjects.get(index)!;
    const profile = availabilityProfile(index);
    if (profile !== "UNKNOWN") {
      const validUntil =
        profile === "EXPIRED"
          ? addDays(utcDate(todayIso), -1)
          : profile === "EXPIRES_BEFORE_ENTRY"
            ? addDays(semester.startDate, -1)
            : addDays(semester.startDate, 45);
      const formats = index === 223 ? ["ONLINE" as const] : [group?.format ?? "IN_PERSON"];
      await database.studentAvailability.create({
        data: {
          id: organizationId("availability", { semesterName: semester.name, key: subject.key }),
          studentId: subject.student.id,
          semesterId: semester.id,
          confirmed: true,
          validUntil,
          formats,
          slots: availabilitySlots(index, group),
          recordedById: staffUser.id,
          notes:
            profile === "EXPIRED"
              ? "Contato anterior já venceu; confirmar novamente para organizar a entrada."
              : profile === "EXPIRES_BEFORE_ENTRY"
                ? "Família confirmou somente até o fim do semestre atual; renovar para a entrada futura."
                : profile === "INCOMPATIBLE"
                  ? "Disponibilidade informada pelo aluno ou responsável; conciliar a proposta sem ampliar esta confirmação."
                  : "Disponibilidade confirmada especificamente para a entrada no próximo semestre.",
          createdAt: dates.availability,
          updatedAt: dates.availability,
        },
      });
      await recordActivity(
        database,
        { staffUser, now: dates.availability },
        "semesterOrganization.confirmAvailability",
        {
          subject: { type: "student", id: subject.student.id, name: subject.student.fullName },
          description: `Disponibilidade de ${semester.name} confirmada até ${isoOf(validUntil)}.`,
          deduplicationKey: `seed/semester-availability/${semester.name}/${subject.key}`,
        },
      );
    }
    // One draft changes group later; its initial intention remains in revision 1.
    const initialGroup = index === 134 ? "ppt-b" : group?.key;
    const placementId = organizationId("placement", {
      semesterName: semester.name,
      key: subject.key,
    });
    await database.semesterPlacement.create({
      data: {
        id: placementId,
        semesterId: semester.id,
        planId: initialGroup
          ? organizationId("plan", { semesterName: semester.name, key: initialGroup })
          : null,
        studentId: subject.student.id,
        trackId: subject.trackId,
        stageId: subject.stage?.id ?? null,
        sourceEnrollmentId: subject.source?.id ?? null,
        sourceProgressId: subject.progress?.id ?? null,
        mode: subject.mode,
        notes: proposalNotes(subject),
        version: 1,
        recordedById: staffUser.id,
        createdAt: dates.proposed,
        updatedAt: dates.proposed,
      },
    });
    const context: OrganizationContext = { database, staffUser, now: dates.proposed };
    await placementRevision(context, semester.name, placementId, "PROPOSED");
    await recordOrganizationProposal(context, semester.name, subject, 1);
  }

  for (const index of [134, 40]) {
    const subject = subjects.get(index)!;
    const group = entries.find((row) => row.index === index)!.group!;
    const reason =
      index === 134
        ? "Ajustar a intenção para a primeira faixa da tarde; a confirmação ainda precisa cobrir a data de entrada."
        : "Horário informado não cobre a turma proposta; manter em rascunho até conciliar a disponibilidade e o docente.";
    await database.$transaction(async (transaction) => {
      const context = { database: transaction, staffUser, now: dates.revised };
      const placementId = organizationId("placement", {
        semesterName: semester.name,
        key: subject.key,
      });
      await transaction.semesterPlacement.update({
        where: { id: placementId },
        data: {
          planId: organizationId("plan", { semesterName: semester.name, key: group.key }),
          notes: `${proposalNotes(subject)} ${reason}`,
          version: { increment: 1 },
          updatedAt: dates.revised,
        },
      });
      await placementRevision(context, semester.name, placementId, "REVISED", reason);
      await recordOrganizationProposal(context, semester.name, subject, 2);
    });
  }

  let published = 0;
  let publishedGroups = 0;
  for (const group of ORGANIZATION_GROUPS.filter((row) => row.published.length > 0)) {
    const selected = group.published.map((index) => subjects.get(index)!);
    // Earlier calendar bootstraps may not yet contain the confirmed academic evidence.
    // Leave those intentions pending instead of manufacturing grades or a decision.
    if (
      !selected.every((subject) => sourceCanPublish(subject, dates.published, semester.startDate))
    )
      continue;
    await database.$transaction(
      async (transaction) => {
        const context = { database: transaction, staffUser, now: dates.published };
        const planId = organizationId("plan", { semesterName: semester.name, key: group.key });
        const board = await readSemester(context, semester.id);
        const eligible = selected.map((subject) =>
          board.placements.find(
            (row) =>
              row.id ===
              organizationId("placement", { semesterName: semester.name, key: subject.key }),
          ),
        );
        if (eligible.some((row) => !row || row.blockers.length || !row.availability))
          throw new Error(
            `Semester seed publication violates the live eligibility contract for group ${group.key}.`,
          );
        const classroom = await publishedOrganizationClass({
          database: transaction,
          semester,
          group,
          teacherId: teachers.get(group.teacherKey!)!,
          stageId: group.scheduleType === "REGULAR" ? selected[0]!.stage!.id : null,
          previousClassId: selected[0]!.source!.classId,
          adminId: staffUser.id,
          publishedAt: dates.published,
        });
        await transaction.semesterClassPlan.update({
          where: { id: planId },
          data: {
            classId: classroom.id,
            version: { increment: 1 },
            updatedAt: dates.published,
          },
        });
        for (const subject of selected)
          await publishOrganizationStudent({
            context,
            semesterName: semester.name,
            entryDate: semester.startDate,
            subject,
            classId: classroom.id,
            availabilityId: organizationId("availability", {
              semesterName: semester.name,
              key: subject.key,
            }),
          });
        await recordActivity(transaction, context, "classes.create", {
          subject: { type: "class", id: classroom.id, name: classroom.portalClassName },
          description: `Turma de ${semester.name} criada na publicação da organização do semestre.`,
          deduplicationKey: `seed/semester-class/${classroom.id}`,
        });
        await recordActivity(transaction, context, "semesterOrganization.publish", {
          subject: { type: "class", id: classroom.id, name: classroom.portalClassName },
          description: `${selected.length} aluno(s) com entrada programada em ${isoOf(semester.startDate)}; as matrículas de origem permanecem vigentes até essa data.`,
          deduplicationKey: `seed/semester-publish/${planId}`,
        });
      },
      { timeout: 30_000 },
    );
    published += selected.length;
    publishedGroups += 1;
  }
  process.stdout.write(
    `Semester organization loaded: 8 plans, 32 proposals, 30 availability confirmations, ${published} future publications in ${publishedGroups} future classes.\n`,
  );
}
