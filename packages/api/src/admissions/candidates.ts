import type { Prisma } from "@lazuli/db";
import {
  availabilityCovers,
  availabilityIsCurrent,
  CLASS_REFERENCE_CAPACITY,
  saoPauloDateOnly,
} from "@lazuli/domain";
import type { admissionSaveSchema, admissionListSchema, z } from "@lazuli/validators";
import { badRequest, notFound } from "../trpc/errors.js";
import { databaseSlotToCandidate } from "../teachers/availability.js";
import { timeStringToDate } from "../classes/time.js";
import { loadActiveStage } from "../classes/guards.js";

const ISO_DATE_LENGTH = 10;
const ADMISSION_LOCK_NAMESPACE = 168;
export const dateOnly = (date: Date): string => date.toISOString().slice(0, ISO_DATE_LENGTH);
const candidateInclude = {
  availability: true,
  stage: { include: { track: { select: { name: true } } } },
  student: { select: { id: true, fullName: true } },
  enrollment: { select: { id: true, classId: true } },
} satisfies Prisma.AdmissionCandidateInclude;
export type AdmissionCandidate = Prisma.AdmissionCandidateGetPayload<{
  include: typeof candidateInclude;
}>;
export async function readCandidate(
  database: Prisma.TransactionClient,
  id: string,
): Promise<AdmissionCandidate> {
  const row = await database.admissionCandidate.findUnique({
    where: { id },
    include: candidateInclude,
  });
  if (!row || row.deletedAt) throw notFound("Interessado não encontrado.");
  return row;
}
export async function lockCandidate(database: Prisma.TransactionClient, id: string): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`admission:${id}`}, ${ADMISSION_LOCK_NAMESPACE}))`;
}
export function assertAllocatable(
  row: Awaited<ReturnType<typeof readCandidate>>,
  date: string,
): void {
  if (row.status !== "WAITING") throw badRequest("Este interessado não está aguardando alocação.");
  if (!availabilityIsCurrent(dateOnly(row.availableUntil), date))
    throw badRequest(
      "Disponibilidade vencida. Confirme os horários e renove a validade antes de continuar.",
    );
}
export async function saveCandidate(input: {
  database: Prisma.TransactionClient;
  input: z.infer<typeof admissionSaveSchema>;
  recordedById: string;
  now: Date;
}): Promise<{ id: string }> {
  const { database, recordedById, now } = input;
  const { id, values } = input.input;
  await lockCandidate(database, id);
  if (values.availableUntil < saoPauloDateOnly(now))
    throw badRequest("A validade deve ser hoje ou futura.");
  if (values.stageId) await loadActiveStage({ database, stageId: values.stageId });
  if (
    values.studentId &&
    !(await database.student.findFirst({ where: { id: values.studentId, deletedAt: null } }))
  )
    throw notFound("Aluno não encontrado.");
  const existing = await database.admissionCandidate.findUnique({ where: { id } });
  if (existing && existing.status !== "WAITING")
    throw badRequest("Reabra o interessado antes de alterar os dados.");
  const { availability, ...fields } = values;
  const data = {
    ...fields,
    phone: values.phone || null,
    email: values.email || null,
    availableUntil: new Date(values.availableUntil),
    availabilityConfirmedAt: now,
    recordedById,
  };
  await database.admissionCandidate.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  await database.admissionAvailability.deleteMany({ where: { candidateId: id } });
  await database.admissionAvailability.createMany({
    data: availability.map((slot) => ({
      candidateId: id,
      weekday: slot.weekday,
      startTime: timeStringToDate(slot.startTime),
      endTime: timeStringToDate(slot.endTime),
    })),
    skipDuplicates: true,
  });
  return { id };
}
export async function listCandidates(
  database: Prisma.TransactionClient,
  { input, now }: { input: z.infer<typeof admissionListSchema>; now: Date },
): Promise<{
  rows: AdmissionCandidate[];
  total: number;
  today: string;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const today = saoPauloDateOnly(now);
  const where: Prisma.AdmissionCandidateWhereInput = {
    deletedAt: null,
    ...(input.status === "ALL" ? {} : { status: input.status }),
    ...(input.expiredOnly ? { availableUntil: { lt: new Date(today) } } : {}),
    ...(input.search
      ? {
          OR: ["fullName", "phone", "email"].map((field) => ({
            [field]: { contains: input.search, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    database.admissionCandidate.findMany({
      where,
      include: candidateInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    database.admissionCandidate.count({ where }),
  ]);
  return {
    rows,
    total,
    today,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}
export async function matchingClasses(
  database: Prisma.TransactionClient,
  { id, date }: { id: string; date: string },
): Promise<ClassMatch[]> {
  const candidate = await readCandidate(database, id);
  assertAllocatable(candidate, date);
  if (!candidate.stageId)
    throw badRequest("Registre o estágio indicado pelo nivelamento antes de buscar turmas.");
  const rows = await database.class.findMany({
    where: matchingWhere(candidate, date),
    include: {
      scheduleSlots: { where: { deletedAt: null } },
      sharedStage: { select: { name: true } },
      semester: { select: { name: true, endDate: true } },
      _count: {
        select: {
          enrollments: {
            where: {
              deletedAt: null,
              entryDate: { lte: new Date(date) },
              OR: [{ exitDate: null }, { exitDate: { gt: new Date(date) } }],
            },
          },
        },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
  return rows
    .filter((row) =>
      availabilityCovers(
        candidate.availability.map((slot) => databaseSlotToCandidate(slot)),
        row.scheduleSlots.map((slot) => databaseSlotToCandidate(slot)),
      ),
    )
    .map((row) => ({
      id: row.id,
      name: row.portalClassName,
      stageName: row.sharedStage?.name ?? candidate.stage?.name,
      semester: row.semester.name,
      through: dateOnly(row.semester.endDate),
      scheduleType: row.scheduleType,
      slots: row.scheduleSlots.map((slot) => databaseSlotToCandidate(slot)),
      enrolled: row._count.enrollments,
      capacity: CLASS_REFERENCE_CAPACITY,
    }));
}

type ClassMatch = {
  id: string;
  name: string;
  stageName: string | undefined;
  semester: string;
  through: string;
  scheduleType: AdmissionCandidate["scheduleType"];
  slots: ReturnType<typeof databaseSlotToCandidate>[];
  enrolled: number;
  capacity: number;
};
function matchingWhere(candidate: AdmissionCandidate, date: string): Prisma.ClassWhereInput {
  return {
    deletedAt: null,
    status: "ACTIVE",
    scheduleType: candidate.scheduleType,
    format: candidate.format,
    ...(candidate.scheduleType === "REGULAR" ? { sharedStageId: candidate.stageId } : {}),
    semester: {
      deletedAt: null,
      startDate: { lte: new Date(date) },
      endDate: { gte: new Date(date) },
    },
  };
}
