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

type IntakeValues = z.infer<typeof studentIntakeOptionsSchema>;
type IntakeClass = Prisma.ClassGetPayload<{
  include: {
    scheduleSlots: true;
    sharedStage: { select: { name: true } };
    _count: { select: { enrollments: true } };
  };
}>;
type Meeting = Awaited<ReturnType<typeof meetingsBetween>>[number];
type IntakeOptionsResult = {
  today: string;
  semester: { id: string; name: string; startDate: Date; endDate: Date } | null;
  classes: Array<{
    id: string;
    name: string;
    stageName: string;
    scheduleType: IntakeClass["scheduleType"];
    format: IntakeClass["format"];
    slots: Array<ReturnType<typeof databaseSlotToCandidate>>;
    enrolled: number;
    capacity: number;
  }>;
  meetings: Array<Pick<Meeting, "classId" | "date" | "startTime" | "endTime">>;
};

export async function studentIntakeOptions(
  database: Prisma.TransactionClient,
  options: {
    input: z.infer<typeof studentIntakeOptionsSchema>;
    now: Date;
  },
): Promise<IntakeOptionsResult> {
  const { input, now } = options;

  const today = saoPauloDateOnly(now);
  const semester = await database.period.findFirst({
    where: {
      deletedAt: null,
      startDate: { lte: new Date(today) },
      endDate: { gte: new Date(today) },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const classes = await intakeClasses(database, { semesterId: semester?.id ?? null, input, today });
  const eligibleIds = new Set(classes.map((row) => row.id));
  const meetings = await intakeMeetings(database, { semester, input, now, today, eligibleIds });
  return {
    today,
    semester,
    classes: classes.map((row) => {
      const slots = row.scheduleSlots.map((slot) => databaseSlotToCandidate(slot));
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

async function intakeMeetings(
  database: Prisma.TransactionClient,
  {
    semester,
    input,
    now,
    today,
    eligibleIds,
  }: {
    semester: IntakeOptionsResult["semester"];
    input: IntakeValues;
    now: Date;
    today: string;
    eligibleIds: Set<string>;
  },
): Promise<Meeting[]> {
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
  return candidates.filter((row) => eligibleIds.has(row.classId) && !row.cancelled);
}

async function intakeClasses(
  database: Prisma.TransactionClient,
  { semesterId, input, today }: { semesterId: string | null; input: IntakeValues; today: string },
): Promise<IntakeClass[]> {
  if (!semesterId || !input.stageId) return [];
  return database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semesterId,
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
  });
}

type EnrollValues = z.infer<typeof studentIntakeEnrollSchema>;
type EnrollInput = {
  database: TransactionClient;
  values: EnrollValues;
  recordedById: string;
  now: Date;
};
type EnrollResult = {
  studentId: string;
  enrollmentId: string | null;
  classId: string | null;
  contractId: string | null;
};
type Candidate = Awaited<ReturnType<typeof readCandidate>>;
type ClassModel = Prisma.ClassGetPayload<Prisma.ClassDefaultArgs>;

export async function enrollNewStudent(input: EnrollInput): Promise<EnrollResult> {
  const { database, values, now } = input;
  const enrollmentDatabase = captureEnrollmentTransaction(database);
  const semester = await lockIntakeSemester(database, now);
  await lockTeacher(database, "");
  await lockCreationCommand(database, values.commandId);
  await assertCreationCommandOwner(database, { id: values.commandId, owner: "studentCompletion" });
  const { leadRegistration, ...existingIntake } = values;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(leadRegistration ? values : existingIntake))
    .digest("hex");
  const previous = await existingIntakeResult(database, { values, fingerprint });
  if (previous) return previous;
  const candidate = await captureIntakeCandidate(input);
  const today = saoPauloDateOnly(now);
  assertBirthDate(values.student.birthDate, today);
  const target = values.classId
    ? await intakeTarget(database, {
        classId: values.classId,
        stageId: values.stageId,
        candidate,
        today,
      })
    : null;
  const activeSemester = requireIntakePeriod({ semester, target, candidate });
  const created = await createIntakeMembership(input, { enrollmentDatabase, target, today });
  await finalizeIntake(input, {
    ...created,
    semester: activeSemester,
    candidate,
    target,
    fingerprint,
  });
  return { ...created, classId: target?.id ?? null };
}

function assertBirthDate(birthDate: Date | null | undefined, today: string): void {
  if (birthDate && birthDate > new Date(today))
    throw badRequest("O nascimento não pode estar no futuro.");
}

function requireIntakePeriod({
  semester,
  target,
  candidate,
}: {
  semester: Awaited<ReturnType<typeof lockIntakeSemester>>;
  target: ClassModel | null;
  candidate: Candidate | null;
}): NonNullable<Awaited<ReturnType<typeof lockIntakeSemester>>> {
  if (!semester)
    throw badRequest("Não há período vigente. Mantenha a pessoa como lead até a entrada.");
  if (!target && candidate?.allocationPlan && candidate.allocationPlan.semesterId !== semester.id)
    throw badRequest(
      "Este lead aguarda outro período. Mantenha o interesse na turma até a entrada ou escolha uma turma vigente.",
    );
  return semester;
}

async function existingIntakeResult(
  database: TransactionClient,
  { values, fingerprint }: { values: EnrollValues; fingerprint: string },
): Promise<EnrollResult | null> {
  const previous = await database.student.findUnique({ where: { commandId: values.commandId } });
  if (!previous) return null;
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

async function captureIntakeCandidate(input: EnrollInput): Promise<Candidate | null> {
  const { database, values } = input;
  const candidateId = values.candidateId ?? values.leadRegistration?.lead.id;
  if (candidateId) await lockCandidate(database, candidateId);
  if (values.leadRegistration) await registerIntakeLead(input);
  const candidate = candidateId ? await readCandidate(database, candidateId) : null;
  if (candidate) assertIntakeCandidateAvailable(candidate);
  if (candidate)
    await requireLeadGuardian(database, {
      candidate,
      student: { mode: "create", values: values.student },
    });
  return candidate;
}

function assertIntakeCandidateAvailable(candidate: Candidate): void {
  if (candidate.status !== "WAITING" || candidate.enrollmentId || candidate.studentId)
    throw badRequest(
      "Este lead já está vinculado a um aluno ou não está em acompanhamento. Abra o cadastro existente.",
    );
}

async function registerIntakeLead(input: EnrollInput): Promise<void> {
  const { database, values, recordedById, now } = input;
  const registration = values.leadRegistration;
  if (!registration) return;
  const existing = await database.admissionCandidate.findUnique({
    where: { id: registration.lead.id },
    select: { id: true },
  });
  if (existing)
    throw badRequest("Este identificador de lead já foi utilizado. Selecione o lead existente.");
  await captureLead({ database, values: registration.lead, recordedById, now });
  if (registration.placement)
    await schedulePlacement({ database, values: registration.placement, recordedById, now });
}

async function createIntakeMembership(
  input: EnrollInput,
  {
    enrollmentDatabase,
    target,
    today,
  }: {
    enrollmentDatabase: ReturnType<typeof captureEnrollmentTransaction>;
    target: ClassModel | null;
    today: string;
  },
): Promise<{ studentId: string; enrollmentId: string | null; contractId: string | null }> {
  const { database, values, recordedById, now } = input;
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
  return {
    studentId: student.id,
    enrollmentId: enrollment?.enrollment.id ?? null,
    contractId: contract?.id ?? null,
  };
}

async function finalizeIntake(
  input: EnrollInput,
  {
    studentId,
    enrollmentId,
    semester,
    candidate,
    target,
    fingerprint,
  }: {
    studentId: string;
    enrollmentId: string | null;
    semester: Awaited<ReturnType<typeof lockIntakeSemester>>;
    candidate: Candidate | null;
    target: ClassModel | null;
    fingerprint: string;
  },
): Promise<void> {
  const { database, values, recordedById, now } = input;
  await database.student.update({
    where: { id: studentId },
    data: { commandId: values.commandId, commandFingerprint: fingerprint },
  });
  if (candidate)
    await database.admissionCandidate.update({
      where: { id: candidate.id },
      data: {
        studentId,
        recordedById,
        ...(target && enrollmentId
          ? {
              status: "ENROLLED",
              enrollmentId,
              stageId: values.stageId,
              scheduleType: target.scheduleType,
            }
          : {}),
      },
    });
  await syncStudentIntake(database, {
    semester,
    studentId,
    stageId: values.stageId,
    enrollmentId,
    candidate,
    recordedById,
    now,
  });
}

async function intakeTarget(
  database: Prisma.TransactionClient,
  options: {
    classId: string;
    stageId: string | null;
    candidate: Awaited<ReturnType<typeof readCandidate>> | null;
    today: string;
  },
): Promise<ClassModel> {
  const { classId, stageId, candidate, today } = options;

  if (!stageId) throw badRequest("Escolha o estágio antes de confirmar a turma.");
  await assertIntakeStage(database, { stageId, candidate });
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

async function assertIntakeStage(
  database: Prisma.TransactionClient,
  { stageId, candidate }: { stageId: string; candidate: Candidate | null },
): Promise<void> {
  if (candidate?.englishExperience === "SOME") {
    await assertPlacementReady(database, candidate);
    if (candidate.stageId !== stageId) throw badRequest("Use o estágio definido no nivelamento.");
  } else if (!candidate || candidate.englishExperience === "NONE") {
    await assertInitialStage(database, stageId);
  } else if (candidate.stageId !== stageId || !candidate.stageId) {
    throw badRequest("Confirme a experiência com inglês e o estágio no lead antes da matrícula.");
  }
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
  const semester = await lockIntakeSemester(database, now);
  await lockTeacher(database, "");
  const candidate = await allocationCandidate(database, values.studentId);
  const today = saoPauloDateOnly(now);
  const target = await intakeTarget(database, {
    classId: values.classId,
    stageId: values.stageId,
    candidate,
    today,
  });
  await assertAllocationGuardian(database, { candidate, studentId: values.studentId });
  const enrollmentId = await createAllocatedEnrollment({
    database,
    values,
    recordedById,
    now,
    today,
    target,
  });
  await markCandidateEnrolled(database, {
    candidate,
    enrollmentId,
    stageId: values.stageId,
    scheduleType: target.scheduleType,
    recordedById,
  });
  await syncStudentIntake(database, {
    semester,
    studentId: values.studentId,
    stageId: values.stageId,
    enrollmentId,
    candidate,
    recordedById,
    now,
  });
  return { studentId: values.studentId, enrollmentId };
}

async function createAllocatedEnrollment({
  database,
  values,
  recordedById,
  now,
  today,
  target,
}: {
  database: TransactionClient;
  values: z.infer<typeof studentIntakeAllocateSchema>;
  recordedById: string;
  now: Date;
  today: string;
  target: Awaited<ReturnType<typeof intakeTarget>>;
}): Promise<string> {
  const result = await createEnrollment({
    database: captureEnrollmentTransaction(database),
    staffUserId: recordedById,
    now,
    values: {
      studentId: values.studentId,
      classId: target.id,
      entryDate: new Date(today),
      ...(target.scheduleType === "PERSONALIZED" ? { stageId: values.stageId } : {}),
    },
  });
  return result.enrollment.id;
}

async function assertAllocationGuardian(
  database: TransactionClient,
  { candidate, studentId }: { candidate: Candidate | null; studentId: string },
): Promise<void> {
  if (candidate)
    await requireLeadGuardian(database, {
      candidate,
      student: { mode: "existing", id: studentId },
    });
}

async function allocationCandidate(
  database: TransactionClient,
  studentId: string,
): Promise<Candidate | null> {
  const snapshot = await database.admissionCandidate.findFirst({
    where: { studentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return null;
  await lockCandidate(database, snapshot.id);
  return readCandidate(database, snapshot.id);
}

async function markCandidateEnrolled(
  database: TransactionClient,
  {
    candidate,
    enrollmentId,
    stageId,
    scheduleType,
    recordedById,
  }: {
    candidate: Candidate | null;
    enrollmentId: string;
    stageId: string;
    scheduleType: ClassModel["scheduleType"];
    recordedById: string;
  },
): Promise<void> {
  if (!candidate || candidate.enrollmentId) return;
  await database.admissionCandidate.update({
    where: { id: candidate.id },
    data: { status: "ENROLLED", enrollmentId, stageId, scheduleType, recordedById },
  });
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
  const state = await readStudentPendingActions(database, { id: values.studentId, now });
  await assertResumeState(database, { state, values });
  await updateStudentContact({ database, id: values.studentId, values: values.contact });
  await assertResumeGuardian(database, { state, studentId: values.studentId });
  if (!state.enrollment && values.classId) {
    if (!values.stageId) throw badRequest("Escolha o estágio antes de confirmar a turma.");
    await allocateIntakeStudent({
      database,
      values: { studentId: values.studentId, classId: values.classId, stageId: values.stageId },
      recordedById,
      now,
    });
  }
  const contract = await createMissingIntakeContract(database, { state, values, recordedById });
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

async function createMissingIntakeContract(
  database: TransactionClient,
  {
    state,
    values,
    recordedById,
  }: {
    state: ResumeState;
    values: ResumeValues;
    recordedById: string;
  },
): Promise<Awaited<ReturnType<ReturnType<typeof finance>["createMonthlyContract"]>> | null> {
  if (state.contract || !values.contract) return null;
  return finance(database, recordedById).createMonthlyContract(values.contract);
}

type ResumeState = Awaited<ReturnType<typeof readStudentPendingActions>>;
type ResumeValues = z.infer<typeof studentIntakeResumeSchema>;

async function assertResumeState(
  database: TransactionClient,
  { state, values }: { state: ResumeState; values: ResumeValues },
): Promise<void> {
  if (state.enrollment && values.classId && state.enrollment.classId !== values.classId)
    throw badRequest("Este aluno já tem turma. Atualize o cadastro para continuar.");
  await assertResumeContract(database, { state, values });
  if (
    !values.allowPending &&
    ((!state.enrollment && !values.classId) || (!state.contract && !values.contract))
  )
    throw badRequest("Confirme o cadastro com pendências.");
}

async function assertResumeContract(
  database: TransactionClient,
  { state, values }: { state: ResumeState; values: ResumeValues },
): Promise<void> {
  if (!state.contract || !values.contract) return;
  const same = await database.contract.findUnique({
    where: { commandId: values.contract.commandId },
    select: { id: true },
  });
  if (same?.id !== state.contract.id)
    throw badRequest("Este aluno já tem contrato. Atualize o cadastro para continuar.");
}

async function assertResumeGuardian(
  database: TransactionClient,
  { state, studentId }: { state: ResumeState; studentId: string },
): Promise<void> {
  if (state.lead) {
    const candidate = await readCandidate(database, state.lead.id);
    await requireLeadGuardian(database, {
      candidate,
      student: { mode: "existing", id: studentId },
    });
  }
}
