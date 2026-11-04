import { saoPauloDateOnly } from "@lazuli/domain";
import { currentScholarshipContractWhere } from "./scholarship.js";
import type { Prisma } from "@lazuli/db";
import {
  MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE,
  MINOR_REQUIRES_GUARDIAN_MESSAGE,
  studentCreateInputSchema,
} from "@lazuli/validators";
import type { studentUpdateContactInputSchema, z } from "@lazuli/validators";

import { badRequest, notFound } from "../trpc/errors.js";
import { isMinorTodayInSaoPaulo } from "./date-rules.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import type { StudentProfile } from "./profile.js";
import { toStudentProfile } from "./profile.js";
import {
  createOptionalAddress,
  resolveCreateGuardian,
  resolveStudentAddress,
  resolveUpdateGuardian,
  type StudentDatabase,
} from "./related-records.js";

type StudentCreateInput = z.infer<typeof studentCreateInputSchema>;
type StudentUpdateContactInput = z.infer<typeof studentUpdateContactInputSchema>;

export { searchStudents } from "./search.js";
export type { StudentSearchResult } from "./search.js";

const studentProfileInclude = {
  address: true,
  guardian: { include: { address: true } },
} as const;

export async function readStudentProfile(input: {
  database: StudentDatabase;
  id: string;
  now?: Date;
}): Promise<StudentProfile> {
  const now = input.now ?? new Date();
  const today = new Date(saoPauloDateOnly(now));
  const student = await input.database.student.findUnique({
    where: { id: input.id },
    include: {
      _count: {
        select: {
          enrollments: {
            where: {
              deletedAt: null,
              class: { deletedAt: null },
              entryDate: { lte: today },
              OR: [{ exitDate: null }, { exitDate: { gt: today } }],
            },
          },
        },
      },
      ...studentProfileInclude,
      contracts: {
        where: currentScholarshipContractWhere(now),
        select: { id: true },
        take: 1,
      },
    },
  });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }

  return toStudentProfile(student);
}

export async function createStudent(input: {
  database: StudentDatabase;
  values: StudentCreateInput;
}): Promise<{ id: string }> {
  assertStudentIdentity({
    fullName: input.values.fullName,
    documentNumber: input.values.documentNumber,
    documentType: input.values.documentType,
    birthDate: input.values.birthDate,
    phone: input.values.phone,
    email: input.values.email,
  });
  assertCreateGuardianRequirement(input.values);

  const addressId = await createOptionalAddress(input.database, input.values.address);
  const guardianId = await resolveCreateGuardian({
    addressId,
    database: input.database,
    guardian: input.values.guardian,
  });

  await assertMinorGuardianContactRequirement({
    birthDate: input.values.birthDate,
    database: input.database,
    guardianId,
  });

  const student = await input.database.student.create({
    data: toStudentCreateData({ addressId, guardianId, values: input.values }),
  });

  return { id: student.id };
}

export async function updateStudentContact(input: {
  database: StudentDatabase;
  id: string;
  values: StudentUpdateContactInput;
}): Promise<{ id: string }> {
  const student = await loadStudentForUpdate(input.database, input.id);
  assertStudentIdentity({
    fullName: input.values.fullName ?? student.fullName,
    documentNumber:
      input.values.documentNumber === undefined
        ? student.documentNumber
        : input.values.documentNumber,
    documentType:
      input.values.documentType === undefined ? student.documentType : input.values.documentType,
    birthDate: input.values.birthDate === undefined ? student.birthDate : input.values.birthDate,
    phone: input.values.phone === undefined ? student.phone : input.values.phone,
    email: input.values.email === undefined ? student.email : input.values.email,
  });
  const addressId = await resolveStudentAddress({
    address: input.values.address,
    database: input.database,
    existingAddressId: student.addressId,
  });
  const effectiveAddressId = addressId === undefined ? student.addressId : addressId;
  const guardianId = await resolveUpdateGuardian({
    addressId: effectiveAddressId,
    database: input.database,
    existingGuardianId: student.guardianId,
    guardian: input.values.guardian,
  });

  assertUpdateGuardianRequirement({ guardianId, student, values: input.values });
  await assertMinorGuardianContactRequirement({
    birthDate: input.values.birthDate === undefined ? student.birthDate : input.values.birthDate,
    database: input.database,
    guardianId: guardianId === undefined ? student.guardianId : guardianId,
  });

  await input.database.student.update({
    where: { id: input.id },
    data: toStudentUpdateData({ addressId, guardianId, values: input.values }),
  });

  return { id: input.id };
}

function toStudentCreateData(input: {
  addressId: string | null;
  guardianId: string | null;
  values: StudentCreateInput;
}): Prisma.StudentUncheckedCreateInput {
  return {
    addressId: input.addressId,
    birthDate: input.values.birthDate ?? null,
    documentNumber: input.values.documentNumber ?? null,
    documentType: input.values.documentType ?? null,
    email: input.values.email ?? null,
    fullName: input.values.fullName,
    guardianId: input.guardianId,
    notes: input.values.notes ?? null,
    phone: input.values.phone ?? null,
    status: input.values.status ?? "ACTIVE",
  };
}

function toStudentUpdateData(input: {
  addressId: string | null | undefined;
  guardianId: string | null | undefined;
  values: StudentUpdateContactInput;
}): Prisma.StudentUncheckedUpdateInput {
  const data: Prisma.StudentUncheckedUpdateInput = {};

  if (input.addressId !== undefined) data.addressId = input.addressId;
  if (input.values.birthDate !== undefined) data.birthDate = input.values.birthDate;
  if (input.values.documentNumber !== undefined) data.documentNumber = input.values.documentNumber;
  if (input.values.documentType !== undefined) data.documentType = input.values.documentType;
  if (input.values.email !== undefined) data.email = input.values.email;
  if (input.values.fullName !== undefined) data.fullName = input.values.fullName;
  if (input.guardianId !== undefined) data.guardianId = input.guardianId;
  if (input.values.phone !== undefined) data.phone = input.values.phone;

  return data;
}

async function loadStudentForUpdate(
  database: StudentDatabase,
  id: string,
): Promise<
  Pick<
    Prisma.StudentGetPayload<Prisma.StudentDefaultArgs>,
    | "addressId"
    | "birthDate"
    | "guardianId"
    | "fullName"
    | "documentType"
    | "documentNumber"
    | "phone"
    | "email"
  >
> {
  const student = await database.student.findUnique({
    where: { id },
    select: {
      addressId: true,
      birthDate: true,
      guardianId: true,
      fullName: true,
      documentNumber: true,
      documentType: true,
      phone: true,
      email: true,
    },
  });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }

  return student;
}

function assertCreateGuardianRequirement(values: StudentCreateInput): void {
  if (isMinorTodayInSaoPaulo(values.birthDate) && values.guardian === undefined) {
    throw badRequest(MINOR_REQUIRES_GUARDIAN_MESSAGE);
  }
}

function assertUpdateGuardianRequirement(input: {
  guardianId: string | null | undefined;
  student: { birthDate: Date | null; guardianId: string | null };
  values: StudentUpdateContactInput;
}): void {
  const birthDate =
    input.values.birthDate === undefined ? input.student.birthDate : input.values.birthDate;
  const guardianId = input.guardianId === undefined ? input.student.guardianId : input.guardianId;

  if (isMinorTodayInSaoPaulo(birthDate) && guardianId === null) {
    throw badRequest(MINOR_REQUIRES_GUARDIAN_MESSAGE);
  }
}

async function assertMinorGuardianContactRequirement(input: {
  birthDate: Date | null | undefined;
  database: StudentDatabase;
  guardianId: string | null;
}): Promise<void> {
  if (input.guardianId === null) {
    return;
  }

  const guardian = await input.database.guardian.findUnique({
    where: { id: input.guardianId },
    select: { email: true, phone: true, documentType: true, documentNumber: true },
  });

  if (guardian && !hasGuardianDocument(guardian)) {
    throw badRequest("Informe o CPF ou RG do responsável.");
  }
  if (guardian === null || (!guardian.email?.trim() && !guardian.phone?.trim())) {
    throw badRequest(MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE);
  }
}

function assertStudentIdentity(
  values: Pick<
    StudentCreateInput,
    "fullName" | "documentNumber" | "documentType" | "birthDate" | "phone" | "email"
  >,
): void {
  const parsed = studentCreateInputSchema.safeParse(values);
  if (!parsed.success)
    throw badRequest(parsed.error.issues[0]?.message ?? "Complete os dados obrigatórios do aluno.");
}

function hasGuardianDocument(guardian: {
  documentType: string | null;
  documentNumber: string | null;
}): boolean {
  return Boolean(guardian.documentType && guardian.documentNumber?.trim());
}
