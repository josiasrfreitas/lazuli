import type { Prisma } from "@lazuli/db";
import { MINOR_REQUIRES_GUARDIAN_MESSAGE } from "@lazuli/validators";
import type {
  studentCreateInputSchema,
  studentUpdateContactInputSchema,
  z,
} from "@lazuli/validators";

import { isMinorInSaoPaulo } from "./date-rules.js";
import { badRequest, notFound, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
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

const studentProfileInclude = {
  address: true,
  guardian: { include: { address: true } },
} as const;

export async function readStudentProfile(input: {
  database: StudentDatabase;
  id: string;
}): Promise<StudentProfile> {
  const student = await input.database.student.findUnique({
    where: { id: input.id },
    include: studentProfileInclude,
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
  assertCreateGuardianRequirement(input.values);

  const addressId = await createOptionalAddress(input.database, input.values.address);
  const guardianId = await resolveCreateGuardian({
    addressId,
    database: input.database,
    guardian: input.values.guardian,
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
): Promise<{
  addressId: string | null;
  birthDate: Date | null;
  guardianId: string | null;
}> {
  const student = await database.student.findUnique({
    where: { id },
    select: { addressId: true, birthDate: true, guardianId: true },
  });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }

  return student;
}

function assertCreateGuardianRequirement(values: StudentCreateInput): void {
  if (isMinorInSaoPaulo(values.birthDate) && values.guardian === undefined) {
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

  if (isMinorInSaoPaulo(birthDate) && guardianId === null) {
    throw badRequest(MINOR_REQUIRES_GUARDIAN_MESSAGE);
  }
}
