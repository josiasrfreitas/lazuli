import type { DatabaseClient } from "../../packages/db/src/client.js";
import {
  DEV_ADMIN,
  DEV_CLASSES,
  DEV_STUDENTS,
  DEV_SYSTEM_ADMIN,
  DEV_TEACHERS,
} from "../../packages/db/src/seed-dev-data.js";
import { isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { ACTIVITY_ACTIONS, type ActivityAction } from "../../packages/api/src/activity/catalog.js";
import type { ActivitySubject } from "../../packages/api/src/activity/record.js";

const RECENT_SESSIONS_PER_CLASS = 3;
const RECENT_GRADE_GROUPS_PER_PHASE = 16;
const PAYMENTS_PER_MONTH = 8;
const PAYMENTS_PER_MONTH_METHOD = 2;
const CENTS_PER_REAL = 100;
const MONTH_PREFIX_LENGTH = 7;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  CARD: "cartão",
  TRANSFER: "transferência",
  CASH: "dinheiro",
};
const BUSINESS_EVENT_UTC_HOUR = 18;
const PHASE_LABELS = {
  BLOCK_ONE: "Primeiro bloco",
  BLOCK_TWO: "Segundo bloco",
  RECOVERY: "Recuperação",
} as const;

type ActivityInput = {
  action: ActivityAction;
  key: string;
  occurredAt: Date;
  actorId: string;
  subject: ActivitySubject;
  description?: string;
};
type ActivityRow = {
  id: string;
  occurredAt: Date;
  actorId: string;
  actorName: string;
  area: string;
  action: string;
  title: string;
  subjectType: ActivitySubject["type"];
  subjectId: string | null;
  subjectName: string;
  description: string | null;
  deduplicationKey: string;
};
type ActivityContext = {
  database: DatabaseClient;
  todayIso: string;
  now: Date;
  adminId: string;
  actors: Map<string, string>;
  events: ActivityRow[];
  studentIds: string[];
  classIds: string[];
};

/** Reconstructs a bounded development timeline from facts loaded earlier in the same bootstrap. */
export async function seedActivity(database: DatabaseClient, todayIso: string): Promise<void> {
  const staff = await database.user.findMany({
    where: {
      email: {
        in: [DEV_ADMIN.email, DEV_SYSTEM_ADMIN.email, ...DEV_TEACHERS.map((row) => row.email)],
      },
    },
    select: { id: true, name: true, email: true },
  });
  const admin = staff.find((row) => row.email === DEV_ADMIN.email);
  if (!admin) throw new Error("Development activity requires the school administrator.");
  const context: ActivityContext = {
    database,
    todayIso,
    now: new Date(),
    adminId: admin.id,
    actors: new Map(staff.map((row) => [row.id, row.name])),
    events: [],
    studentIds: DEV_STUDENTS.map((row) => stableUuid(["student", row.key])),
    classIds: DEV_CLASSES.map((row) => stableUuid(["class", row.key])),
  };
  await enrollmentActivity(context);
  await sessionActivity(context);
  await assessmentActivity(context);
  await admissionActivity(context);
  await financialActivity(context);
  await schoolActivity(context);
  await database.activityEvent.createMany({ data: context.events, skipDuplicates: true });
}

function appendEvent(context: ActivityContext, input: ActivityInput): void {
  if (input.occurredAt > context.now || schoolDate(input.occurredAt) > context.todayIso) return;
  const actorName = context.actors.get(input.actorId);
  if (!actorName) throw new Error("Development activity refers to an unknown staff author.");
  const [area, title] = ACTIVITY_ACTIONS[input.action];
  context.events.push({
    id: stableUuid(["activity", input.action, input.key]),
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    actorName,
    area,
    action: input.action,
    title,
    subjectType: input.subject.type,
    subjectId: input.subject.id ?? null,
    subjectName: input.subject.name,
    description: input.description ?? null,
    deduplicationKey: `dev-activity:${input.action}:${input.key}`,
  });
}

function businessTimestamp(date: Date): Date {
  const timestamp = new Date(date);
  timestamp.setUTCHours(BUSINESS_EVENT_UTC_HOUR, 0, 0, 0);
  return timestamp;
}

function schoolDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

async function enrollmentActivity(context: ActivityContext): Promise<void> {
  const rows = await context.database.enrollmentAction.findMany({
    where: {
      kind: "ENTRY",
      status: "APPLIED",
      deletedAt: null,
      enrollment: { studentId: { in: context.studentIds } },
    },
    include: { enrollment: { include: { student: true, class: true } } },
  });
  for (const row of rows)
    appendEvent(context, {
      action: "enrollment.create",
      key: row.id,
      occurredAt: businessTimestamp(row.effectiveDate),
      actorId: row.recordedById,
      subject: {
        type: "student",
        id: row.enrollment.student.id,
        name: row.enrollment.student.fullName,
      },
      description: `Entrada em ${row.enrollment.class.portalClassName} a partir de ${isoOf(row.effectiveDate)}.`,
    });
}

async function sessionActivity(context: ActivityContext): Promise<void> {
  for (const classId of context.classIds) {
    const rows = await context.database.classSession.findMany({
      where: {
        classId,
        deletedAt: null,
        attendanceConfirmedAt: { not: null },
        date: { lt: utcDate(context.todayIso) },
      },
      include: { class: true },
      orderBy: { date: "desc" },
      take: RECENT_SESSIONS_PER_CLASS,
    });
    for (const row of rows) {
      if (!row.attendanceConfirmedAt || !row.attendanceConfirmedById) continue;
      appendEvent(context, {
        action: "attendance.confirmSession",
        key: row.id,
        occurredAt: row.attendanceConfirmedAt,
        actorId: row.attendanceConfirmedById,
        subject: { type: "class", id: row.classId, name: row.class.portalClassName },
        description: `Aula de ${isoOf(row.date)}: frequência conferida pelo docente responsável.`,
      });
    }
  }
}

type GradeGroup = { phase: keyof typeof PHASE_LABELS; event: ActivityInput };
async function assessmentActivity(context: ActivityContext): Promise<void> {
  const rows = await context.database.stageAssessment.findMany({
    where: { studentId: { in: context.studentIds }, deletedAt: null },
    include: { student: true, stage: true, grades: { where: { deletedAt: null } } },
    orderBy: [{ startedOn: "asc" }, { id: "asc" }],
  });
  const groups: GradeGroup[] = [];
  for (const row of rows) {
    const subject: ActivitySubject = {
      type: "student",
      id: row.studentId,
      name: row.student.fullName,
    };
    groups.push(...assessmentGroups({ row, subject }));
    if (row.confirmedAt && row.confirmedById && row.decision)
      appendEvent(context, {
        action: "assessments.confirm",
        key: row.id,
        occurredAt: row.confirmedAt,
        actorId: row.confirmedById,
        subject,
        description: `${row.stage.internalCode}: ${row.decision === "APPROVED" ? "aprovação" : "repetição"} confirmada pela coordenação.`,
      });
  }
  for (const phase of Object.keys(PHASE_LABELS) as Array<keyof typeof PHASE_LABELS>) {
    const own = groups
      .filter((row) => row.phase === phase)
      .sort((left, right) => right.event.occurredAt.getTime() - left.event.occurredAt.getTime());
    for (const group of own.slice(0, RECENT_GRADE_GROUPS_PER_PHASE))
      appendEvent(context, group.event);
  }
}

type AssessmentFact = {
  id: string;
  stage: { internalCode: string };
  grades: Array<{
    phase: keyof typeof PHASE_LABELS;
    competence: string;
    recordedById: string;
    createdAt: Date;
    assessedOn: Date;
  }>;
};
function assessmentGroups(input: { row: AssessmentFact; subject: ActivitySubject }): GradeGroup[] {
  const groups: GradeGroup[] = [];
  for (const phase of Object.keys(PHASE_LABELS) as Array<keyof typeof PHASE_LABELS>) {
    const grades = input.row.grades.filter((grade) => grade.phase === phase);
    const latest = grades.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0];
    if (!latest) continue;
    groups.push({
      phase,
      event: {
        action: "assessments.save",
        key: `${input.row.id}:${phase}`,
        occurredAt: latest.createdAt,
        actorId: latest.recordedById,
        subject: input.subject,
        description: `${input.row.stage.internalCode} · ${PHASE_LABELS[phase]}: ${grades.length} competência(s), última avaliação em ${isoOf(latest.assessedOn)}.`,
      },
    });
  }
  return groups;
}

async function admissionActivity(context: ActivityContext): Promise<void> {
  const rows = await context.database.admissionCandidate.findMany({
    where: { deletedAt: null },
    include: { enrollment: true },
  });
  for (const row of rows) {
    const subject: ActivitySubject = { type: "lead", id: row.id, name: row.fullName };
    appendEvent(context, {
      action: "admissions.capture",
      key: row.id,
      occurredAt: row.createdAt,
      actorId: row.recordedById,
      subject,
      description: row.source ? `Origem: ${row.source}.` : undefined,
    });
    if (row.status === "ENROLLED" && row.enrollment)
      appendEvent(context, {
        action: "admissions.enroll",
        key: row.id,
        occurredAt: businessTimestamp(row.enrollment.entryDate),
        actorId: row.recordedById,
        subject,
        description: "Entrada concluída e vinculada à matrícula do aluno.",
      });
  }
}

async function financialActivity(context: ActivityContext): Promise<void> {
  const contracts = await context.database.contract.findMany({
    where: { studentId: { in: context.studentIds }, deletedAt: null },
    include: {
      student: true,
      orders: { where: { deletedAt: null }, select: { createdById: true } },
    },
  });
  for (const row of contracts) {
    const actorId = row.orders[0]?.createdById;
    if (!row.agreedOn || !actorId) continue;
    appendEvent(context, {
      action: "finance.createMonthlyContract",
      key: row.commandId ?? row.id,
      occurredAt: businessTimestamp(row.agreedOn),
      actorId,
      subject: { type: "contract", id: row.id, name: `Contrato de ${row.student.fullName}` },
      description: `${row.durationMonths} mensalidades; início em ${row.startsOn ? isoOf(row.startsOn) : "data não definida"}.`,
    });
  }
  await paymentActivity(
    context,
    contracts.map((row) => row.payerId),
  );
}

async function paymentActivity(context: ActivityContext, payerIds: string[]): Promise<void> {
  const rows = await context.database.paymentEntry.findMany({
    where: { payerId: { in: payerIds }, deletedAt: null, date: { lte: utcDate(context.todayIso) } },
    include: { payer: true },
    orderBy: [{ date: "desc" }, { commandId: "asc" }],
  });
  const perMonth = new Map<string, number>();
  const perMethod = new Map<string, number>();
  for (const row of rows) {
    const month = isoOf(row.date).slice(0, MONTH_PREFIX_LENGTH);
    const count = perMonth.get(month) ?? 0;
    const methodKey = `${month}:${row.method}`;
    const methodCount = perMethod.get(methodKey) ?? 0;
    if (!row.createdById || count >= PAYMENTS_PER_MONTH || methodCount >= PAYMENTS_PER_MONTH_METHOD)
      continue;
    perMonth.set(month, count + 1);
    perMethod.set(methodKey, methodCount + 1);
    appendEvent(context, {
      action: "finance.registerPayment",
      key: row.commandId ?? row.id,
      occurredAt: businessTimestamp(row.date),
      actorId: row.createdById,
      subject: { type: "payer", id: row.payerId, name: row.payer.name },
      description: `${paymentAmount(row.amountCents)} recebidos por ${PAYMENT_METHOD_LABELS[row.method] ?? row.method}.`,
    });
  }
}

function paymentAmount(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / CENTS_PER_REAL,
  );
}

async function schoolActivity(context: ActivityContext): Promise<void> {
  await registrationActivity(context);
  await classActivity(context);
  await closedDayActivity(context);
}

async function registrationActivity(context: ActivityContext): Promise<void> {
  const teachers = await context.database.user.findMany({
    where: { email: { in: DEV_TEACHERS.map((row) => row.email) } },
  });
  for (const teacher of teachers)
    appendEvent(context, {
      action: "teachers.create",
      key: teacher.email,
      occurredAt: teacher.createdAt,
      actorId: context.adminId,
      subject: { type: "teacher", id: teacher.id, name: teacher.name },
      description: "Professor cadastrado pela administração.",
    });
  const unallocated = DEV_STUDENTS.filter((student) => student.enrollments.length === 0).map(
    (student) => stableUuid(["student", student.key]),
  );
  const students = await context.database.student.findMany({ where: { id: { in: unallocated } } });
  for (const student of students)
    appendEvent(context, {
      action: "students.create",
      key: student.id,
      occurredAt: student.createdAt,
      actorId: context.adminId,
      subject: { type: "student", id: student.id, name: student.fullName },
      description: "Aluno cadastrado sem matrícula vigente.",
    });
}

async function classActivity(context: ActivityContext): Promise<void> {
  const classes = await context.database.class.findMany({
    where: { id: { in: context.classIds } },
    include: { semester: true, teacher: true },
  });
  for (const row of classes)
    appendEvent(context, {
      action: "classes.create",
      key: row.id,
      occurredAt: row.createdAt,
      actorId: context.adminId,
      subject: { type: "class", id: row.id, name: row.portalClassName },
      description: row.teacher ? `Docente responsável: ${row.teacher.name}.` : undefined,
    });
  const semesters = new Map(classes.map((row) => [row.semester.id, row.semester]));
  for (const semester of semesters.values())
    appendEvent(context, {
      action: "calendar.createSemester",
      key: semester.name,
      occurredAt: semester.createdAt,
      actorId: context.adminId,
      subject: { type: "school", name: "Calendário escolar" },
      description: `Semestre ${semester.name}: ${isoOf(semester.startDate)} a ${isoOf(semester.endDate)}.`,
    });
}

async function closedDayActivity(context: ActivityContext): Promise<void> {
  const rows = await context.database.schoolClosedDay.findMany({ where: { deletedAt: null } });
  for (const row of rows) {
    if (!row.createdById) continue;
    appendEvent(context, {
      action: "calendar.addClosedDay",
      key: isoOf(row.date),
      occurredAt: row.createdAt,
      actorId: row.createdById,
      subject: { type: "school", name: "Calendário escolar" },
      description: `${isoOf(row.date)}: ${row.reason}.`,
    });
  }
}
