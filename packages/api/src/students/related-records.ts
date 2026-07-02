import type { Prisma } from "@lazuli/db";
import type {
  studentCreateInputSchema,
  studentUpdateContactInputSchema,
  z,
} from "@lazuli/validators";

import type { Context } from "../trpc/context.js";
import { GUARDIAN_NOT_FOUND_MESSAGE, notFound } from "./errors.js";

export type StudentDatabase = Pick<
  Context["db"],
  "$executeRaw" | "$queryRaw" | "address" | "guardian" | "student"
>;

type StudentCreateInput = z.infer<typeof studentCreateInputSchema>;
type StudentUpdateContactInput = z.infer<typeof studentUpdateContactInputSchema>;
type AddressInput = NonNullable<StudentCreateInput["address"]>;
type GuardianCreateReference = NonNullable<StudentCreateInput["guardian"]>;
type GuardianUpdateReference = NonNullable<StudentUpdateContactInput["guardian"]>;
type GuardianCreateValues = Extract<GuardianCreateReference, { mode: "create" }>["input"];

export async function createOptionalAddress(
  database: StudentDatabase,
  address: AddressInput | null | undefined,
): Promise<string | null> {
  if (address === null || address === undefined) {
    return null;
  }

  const created = await database.address.create({ data: toAddressData(address) });
  return created.id;
}

export async function resolveStudentAddress(input: {
  address: AddressInput | null | undefined;
  database: StudentDatabase;
  existingAddressId: string | null;
}): Promise<string | null | undefined> {
  if (input.address === undefined) {
    return undefined;
  }
  if (input.address === null) {
    return null;
  }
  if (input.existingAddressId === null) {
    return createOptionalAddress(input.database, input.address);
  }

  await input.database.address.update({
    where: { id: input.existingAddressId },
    data: toAddressUpdateData(input.address),
  });
  return input.existingAddressId;
}

export async function resolveCreateGuardian(input: {
  addressId: string | null;
  database: StudentDatabase;
  guardian: GuardianCreateReference | undefined;
}): Promise<string | null> {
  if (input.guardian === undefined) {
    return null;
  }
  if (input.guardian.mode === "connect") {
    await assertGuardianExists(input.database, input.guardian.id);
    return input.guardian.id;
  }

  return createGuardian({ ...input, guardian: input.guardian });
}

export async function resolveUpdateGuardian(input: {
  addressId: string | null;
  database: StudentDatabase;
  existingGuardianId: string | null;
  guardian: GuardianUpdateReference | undefined;
}): Promise<string | null | undefined> {
  if (input.guardian === undefined) {
    return undefined;
  }
  if (input.guardian.mode === "disconnect") {
    return null;
  }
  if (input.guardian.mode === "connect") {
    await assertGuardianExists(input.database, input.guardian.id);
    return input.guardian.id;
  }
  if (input.guardian.mode === "create") {
    return createGuardian({ ...input, guardian: input.guardian });
  }

  await updateExistingGuardian({ ...input, guardian: input.guardian });
  return input.existingGuardianId;
}

async function createGuardian(input: {
  addressId: string | null;
  database: StudentDatabase;
  guardian: Extract<GuardianCreateReference, { mode: "create" }>;
}): Promise<string> {
  const addressId = await resolveGuardianAddress(input);
  const created = await input.database.guardian.create({
    data: { ...toGuardianData(input.guardian.input), addressId },
  });
  return created.id;
}

async function updateExistingGuardian(input: {
  addressId: string | null;
  database: StudentDatabase;
  existingGuardianId: string | null;
  guardian: Extract<GuardianUpdateReference, { mode: "update" }>;
}): Promise<void> {
  if (input.existingGuardianId === null) {
    throw notFound(GUARDIAN_NOT_FOUND_MESSAGE);
  }

  const addressId = await resolveGuardianUpdateAddress(input);
  const data = toGuardianUpdateData(input.guardian.input);
  if (addressId !== undefined) data.addressId = addressId;

  await input.database.guardian.update({
    where: { id: input.existingGuardianId },
    data,
  });
}

async function resolveGuardianAddress(input: {
  addressId: string | null;
  database: StudentDatabase;
  guardian:
    | Extract<GuardianCreateReference, { mode: "create" }>
    | Extract<GuardianUpdateReference, { mode: "update" }>;
}): Promise<string | null> {
  if (input.guardian.useStudentAddress === true) {
    return input.addressId;
  }

  return createOptionalAddress(input.database, input.guardian.input.address);
}

async function resolveGuardianUpdateAddress(input: {
  addressId: string | null;
  database: StudentDatabase;
  guardian: Extract<GuardianUpdateReference, { mode: "update" }>;
}): Promise<string | null | undefined> {
  if (input.guardian.useStudentAddress === true) {
    return input.addressId;
  }
  if (input.guardian.input.address === undefined) {
    return undefined;
  }

  return createOptionalAddress(input.database, input.guardian.input.address);
}

async function assertGuardianExists(database: StudentDatabase, id: string): Promise<void> {
  const guardian = await database.guardian.findUnique({ where: { id } });

  if (guardian === null) {
    throw notFound(GUARDIAN_NOT_FOUND_MESSAGE);
  }
}

function toAddressData(address: AddressInput): Prisma.AddressUncheckedCreateInput {
  return {
    city: address.city ?? null,
    complement: address.complement ?? null,
    neighborhood: address.neighborhood ?? null,
    number: address.number ?? null,
    postalCode: address.postalCode ?? null,
    state: address.state ?? null,
    street: address.street ?? null,
  };
}

function toAddressUpdateData(address: AddressInput): Prisma.AddressUncheckedUpdateInput {
  const data: Prisma.AddressUncheckedUpdateInput = {};

  if (address.city !== undefined) data.city = address.city;
  if (address.complement !== undefined) data.complement = address.complement;
  if (address.neighborhood !== undefined) data.neighborhood = address.neighborhood;
  if (address.number !== undefined) data.number = address.number;
  if (address.postalCode !== undefined) data.postalCode = address.postalCode;
  if (address.state !== undefined) data.state = address.state;
  if (address.street !== undefined) data.street = address.street;

  return data;
}

function toGuardianData(input: GuardianCreateValues): Prisma.GuardianUncheckedCreateInput {
  return {
    documentNumber: input.documentNumber ?? null,
    documentType: input.documentType ?? null,
    email: input.email ?? null,
    fullName: input.fullName,
    phone: input.phone ?? null,
    relationship: input.relationship ?? null,
  };
}

function toGuardianUpdateData(
  input: Extract<GuardianUpdateReference, { mode: "update" }>["input"],
): Prisma.GuardianUncheckedUpdateInput {
  const data: Prisma.GuardianUncheckedUpdateInput = {};

  if (input.documentNumber !== undefined) data.documentNumber = input.documentNumber;
  if (input.documentType !== undefined) data.documentType = input.documentType;
  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.relationship !== undefined) data.relationship = input.relationship;

  return data;
}
