import { createHash } from "node:crypto";
import type { Prisma, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type {
  studentIntakeOptionsSchema,
  studentIntakeEnrollSchema,
  studentIntakeAllocateSchema,
  studentIntakeResumeSchema,
  z,
} from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { lockCreationCommand, assertCreationCommandOwner } from "../creation-command.js";
import { createEnrollment } from "../enrollment/data.js";
import { captureEnrollmentTransaction } from "../admissions/enroll.js";
import { assertInitialStage } from "../admissions/catalog.js";
import { lockCandidate, readCandidate, dateOnly } from "../admissions/candidates.js";
import { assertPlacementReady } from "../admissions/placement.js";
import { schedulePlacement } from "../admissions/placement.js";
import { captureLead } from "../admissions/capture.js";
import { requireLeadGuardian } from "../admissions/guardian.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { lockTeacher, databaseSlotToCandidate } from "../teachers/availability.js";
import { finance } from "../finance/index.js";
import { readStudentPendingActions } from "./pending-actions.js";
import { createStudent, updateStudentContact } from "./data.js";
import { lockIntakeSemester, syncStudentIntake } from "../semester-organization/student-intake.js";

export async function studentIntakeOptions(
  database: Prisma.TransactionClient,
  input: z.infer<typeof studentIntakeOptionsSchema>,
  now: Date,
) {
  const today = saoPauloDateOnly(now);
  const semester = await database.semester.findFirst({
    where: {
      deletedAt: null,
      startDate: { lte: new Date(today) },
      endDate: { gte: new Date(today) },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const classes =
    semester && input.stageId
      ? await database.class.findMany({
          where: {
            deletedAt: null,
            status: "ACTIVE",
            semesterId: semester.id,
            scheduleType: input.scheduleType,
            format: input.format,
            ...(input.scheduleType === "REGULAR" ? { sharedStageId: input.stageId } : {}),
          },
          include: {
            scheduleSlots: { where: { deletedAt: null } },
            sharedStage: { select: { name: true } },
            _count: {
              select: {
                enrollments: {
                  where: {
                    deletedAt: null,
                    entryDate: { lte: new Date(today) },
                    OR: [{ exitDate: null }, { exitDate: { gt: new Date(today) } }],
                  },
                },
              },
            },
          },
          orderBy: { portalClassName: "asc" },
        })
      : [];
  const eligibleIds = new Set(classes.map((row) => row.id));
  const from = semester
    ? [input.from, dateOnly(semester.startDate), today].toSorted().at(-1)!
    : input.from;
  const through = semester
    ? [input.through, dateOnly(semester.endDate)].toSorted()[0]!
    : input.through;
  const candidates =
    eligibleIds.size > 0 && from <= through
      ? await meetingsBetween({ database, from, through, now })
      : [];
  const meetings = candidates.filter((row) => eligibleIds.has(row.classId) && !row.cancelled);
  return {
    today,
    semester,
    classes: classes.map((row) => {
      const slots = row.scheduleSlots.map(databaseSlotToCandidate);
      return {
        id: row.id,
        name: row.portalClassName,
        stageName: row.sharedStage?.name ?? "Estágio individual",
        scheduleType: row.scheduleType,
        format: row.format,
        slots,
        enrolled: row._count.enrollments,
        capacity: row.capacity,
      };
    }),
    meetings: meetings.map((row) => ({
      classId: row.classId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    })),
  };
}

export async function enrollNewStudent({
  database,
  values,
  recordedById,
  now,
}: {
  database: TransactionClient;
  values: z.infer<typeof studentIntakeEnrollSchema>;
  recordedById: string;
  now: Date;
}): Promise<{
  studentId: string;
  enrollmentId: string | null;
  classId: string | null;
  contractId: string | null;
}> {
  const enrollmentDatabase = captureEnrollmentTransaction(database);
  const semester = await lockIntakeSemester(database, now);
  await lockTeacher(database, "");
  await lockCreationCommand(database, values.commandId);
  await assertCreationCommandOwner(database, { id: values.commandId, owner: "studentCompletion" });
  const { leadRegistration, ...existingIntake } = values;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(leadRegistration ? values : existingIntake))
    .digest("hex");
  const previous = await database.student.findUnique({ where: { commandId: values.commandId } });
  if (previous) {
    if (previous.commandFingerprint !== fingerprint)
      throw badRequest("Esta criação já foi concluída com outros dados.");
    const enrollment = values.classId
      ? await database.enrollment.findFirstOrThrow({
          where: { studentId: previous.id, classId: values.classId },
        })
      : null;
    return {
      studentId: previous.id,
      enrollmentId: enrollment?.id ?? null,
      classId: values.classId,
      contractId: null,
    };
  }
  const candidateId = values.candidateId ?? leadRegistration?.lead.id;
  if (candidateId) await lockCandidate(database, candidateId);
  if (leadRegistration) {
    const existing = await database.admissionCandidate.findUnique({
      where: { id: leadRegistration.lead.id },
      select: { id: true },
    });
    if (existing)
      throw badRequest("Este identificador de lead já foi utilizado. Selecione o lead existente.");
    await captureLead({ database, values: leadRegistration.lead, recordedById, now });
    if (leadRegistration.placement)
      await schedulePlacement({ database, values: leadRegistration.placement, recordedById, now });
  }
  const candidate = candidateId ? await readCandidate(database, candidateId) : null;
  if (
    candidate &&
    (candidate.status !== "WAITING" || candidate.enrollmentId || candidate.studentId)
  )
    throw badRequest(
      "Este lead já está vinculado a um aluno ou não está em acompanhamento. Abra o cadastro existente.",
    );
  if (candidate)
    await requireLeadGuardian(database, candidate, { mode: "create", values: values.student });
  const today = saoPauloDateOnly(now);
  if (values.student.birthDate && values.student.birthDate > new Date(today))
    throw badRequest("O nascimento não pode estar no futuro.");
  const target = values.classId
    ? await intakeTarget(database, values.classId, values.stageId, candidate, today)
    : null;
  const contract = values.contract
    ? await finance(database, recordedById).createMonthlyContract({
        ...values.contract,
        newStudent: values.student,
      })
    : null;
  const student = contract?.student ?? (await createStudent({ database, values: values.student }));
  const enrollment = target
    ? await createEnrollment({
        database: enrollmentDatabase,
        staffUserId: recordedById,
        now,
        values: {
          studentId: student.id,
          classId: target.id,
          entryDate: new Date(today),
          ...(target.scheduleType === "PERSONALIZED" ? { stageId: values.stageId! } : {}),
        },
      })
    : null;
  await database.student.update({
    where: { id: student.id },
    data: { commandId: values.commandId, commandFingerprint: fingerprint },
  });
  if (candidate)
    await database.admissionCandidate.update({
      where: { id: candidate.id },
      data: {
        studentId: student.id,
        recordedById,
        ...(target && enrollment
          ? {
              status: "ENROLLED",
              enrollmentId: enrollment.enrollment.id,
              stageId: values.stageId,
              scheduleType: target.scheduleType,
            }
          : {}),
      },
    });
  await syncStudentIntake(database, {
    semester,
    studentId: student.id,
    stageId: values.stageId,
    enrollmentId: enrollment?.enrollment.id ?? null,
    candidate,
    recordedById,
    now,
  });
  return {
    studentId: student.id,
    enrollmentId: enrollment?.enrollment.id ?? null,
    classId: target?.id ?? null,
    contractId: contract?.id ?? null,
  };
}

async function intakeTarget(
  database: Prisma.TransactionClient,
  classId: string,
  stageId: string | null,
  candidate: Awaited<ReturnType<typeof readCandidate>> | null,
  today: string,
) {
  if (!stageId) throw badRequest("Escolha o estágio antes de confirmar a turma.");
  if (candidate?.englishExperience === "SOME") {
    await assertPlacementReady(database, candidate);
    if (candidate.stageId !== stageId) throw badRequest("Use o estágio definido no nivelamento.");
  } else if (!candidate || candidate.englishExperience === "NONE") {
    await assertInitialStage(database, stageId);
  } else if (candidate.stageId !== stageId || !candidate.stageId) {
    throw badRequest("Confirme a experiência com inglês e o estágio no lead antes da matrícula.");
  }
  const target = await database.class.findFirst({
    where: {
      id: classId,
      deletedAt: null,
      status: "ACTIVE",
      semester: {
        deletedAt: null,
        startDate: { lte: new Date(today) },
        endDate: { gte: new Date(today) },
      },
    },
  });
  if (!target) throw badRequest("Escolha uma turma ativa do semestre atual.");
  if (target.scheduleType === "REGULAR" && target.sharedStageId !== stageId)
    throw badRequest("O estágio da turma é diferente do estágio indicado.");
  return target;
}

export async function allocateIntakeStudent({
  database,
  values,
  recordedById,
  now,
}: {
  database: TransactionClient;
  values: z.infer<typeof studentIntakeAllocateSchema>;
  recordedById: string;
  now: Date;
}): Promise<{ studentId: string; enrollmentId: string }> {
  const enrollmentDatabase = captureEnrollmentTransaction(database);
  const semester = await lockIntakeSemester(database, now);
  await lockTeacher(database, "");
  const snapshot = await database.admissionCandidate.findFirst({
    where: { studentId: values.studentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (snapshot) await lockCandidate(database, snapshot.id);
  const candidate = snapshot ? await readCandidate(database, snapshot.id) : null;
  const today = saoPauloDateOnly(now);
  const target = await intakeTarget(database, values.classId, values.stageId, candidate, today);
  if (candidate)
    await requireLeadGuardian(database, candidate, { mode: "existing", id: values.studentId });
  const result = await createEnrollment({
    database: enrollmentDatabase,
    staffUserId: recordedById,
    now,
    values: {
      studentId: values.studentId,
      classId: target.id,
      entryDate: new Date(today),
      ...(target.scheduleType === "PERSONALIZED" ? { stageId: values.stageId } : {}),
    },
  });
  if (candidate && !candidate.enrollmentId)
    await database.admissionCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "ENROLLED",
        enrollmentId: result.enrollment.id,
        stageId: values.stageId,
        scheduleType: target.scheduleType,
        recordedById,
      },
    });
  await syncStudentIntake(database, {
    semester,
    studentId: values.studentId,
    stageId: values.stageId,
    enrollmentId: result.enrollment.id,
    candidate,
    recordedById,
    now,
  });
  return { studentId: values.studentId, enrollmentId: result.enrollment.id };
}

/** Complete only the missing operations; edits and new operations share one transaction. */
export async function resumeStudentIntake({
  database,
  values,
  recordedById,
  now,
}: {
  database: TransactionClient;
  values: z.infer<typeof studentIntakeResumeSchema>;
  recordedById: string;
  now: Date;
}): Promise<{ studentId: string; contractId: string | null }> {
  const semester = await lockIntakeSemester(database, now);
  await lockTeacher(database, "");
  await database.$executeRaw`SELECT id FROM "Student" WHERE id = ${values.studentId}::uuid FOR UPDATE`;
  const state = await readStudentPendingActions(database, values.studentId, now);
  if (state.enrollment && values.classId && state.enrollment.classId !== values.classId)
    throw badRequest("Este aluno já tem turma. Atualize o cadastro para continuar.");
  if (state.contract && values.contract) {
    const same = await database.contract.findUnique({
      where: { commandId: values.contract.commandId },
      select: { id: true },
    });
    if (same?.id !== state.contract.id)
      throw badRequest("Este aluno já tem contrato. Atualize o cadastro para continuar.");
  }
  if (
    !values.allowPending &&
    ((!state.enrollment && !values.classId) || (!state.contract && !values.contract))
  )
    throw badRequest("Confirme o cadastro com pendências.");
  await updateStudentContact({ database, id: values.studentId, values: values.contact });
  if (state.lead) {
    const candidate = await readCandidate(database, state.lead.id);
    await requireLeadGuardian(database, candidate, { mode: "existing", id: values.studentId });
  }
  if (!state.enrollment && values.classId) {
    if (!values.stageId) throw badRequest("Escolha o estágio antes de confirmar a turma.");
    await allocateIntakeStudent({
      database,
      values: { studentId: values.studentId, classId: values.classId, stageId: values.stageId },
      recordedById,
      now,
    });
  }
  const contract =
    !state.contract && values.contract
      ? await finance(database, recordedById).createMonthlyContract(values.contract)
      : null;
  if (!state.enrollment && !values.classId)
    await syncStudentIntake(database, {
      semester,
      studentId: values.studentId,
      stageId: values.stageId,
      enrollmentId: null,
      candidate: state.lead ? await readCandidate(database, state.lead.id) : null,
      recordedById,
      now,
    });
  return { studentId: values.studentId, contractId: contract?.id ?? null };
}
