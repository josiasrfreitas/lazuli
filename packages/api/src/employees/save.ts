import type { Prisma } from "@lazuli/db";
import type { employeeFields, z } from "@lazuli/validators";
import type { StaffUser } from "../trpc/context.js";
import { badRequest } from "../trpc/errors.js";
import { lockTeacher } from "../teachers/availability.js";
import { attachTeacherUploads } from "../teachers/upload-sessions.js";
import { requireEmployeeEditor } from "./read.js";
import { assertUniqueIdentity } from "./identity.js";

type EmployeeInput = z.infer<typeof employeeFields> & { id?: string | undefined };
const accountSelect = {
  id: true,
  role: true,
  deletedAt: true,
  employeeProfile: { select: { deletedAt: true } },
  teacherProfile: { select: { deletedAt: true } },
} satisfies Prisma.UserSelect;
type Account = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

type Registration = { input: EmployeeInput; current: Account | null };
type ActorInput = { input: EmployeeInput; actor: StaffUser };

function validateRegistration({ input, current: account }: Registration): void {
  const employee = account?.employeeProfile;
  if ((input.id && !employee) || employee?.deletedAt) throw badRequest("Cadastro indisponível.");
  if (!input.id && employee)
    throw badRequest("Colaborador já cadastrado. Abra o cadastro para editar.");
  validateTeaching(input.teaches, account?.teacherProfile);
}

function validateTeaching(teaches: boolean, profile: Account["teacherProfile"] | undefined): void {
  if (profile && !teaches && !profile.deletedAt)
    throw badRequest("Encerre a atuação pela ficha docente.");
  if (teaches && profile?.deletedAt) throw badRequest("Perfil docente arquivado.");
}

function validateAccount(account: Account | null, { input, actor }: ActorInput): void {
  if (account) {
    if (account.deletedAt) throw badRequest("Cadastro arquivado.");
    requireEmployeeEditor(account.role, actor.role);
    if (!input.id || input.role === account.role) return;
  }
  // Linking a pre-provisioned account keeps all of its login settings.
  if (
    input.role === "SUPER_ADMIN" ||
    input.role === "SYSTEM_ADMIN" ||
    account?.role === "SUPER_ADMIN" ||
    account?.role === "SYSTEM_ADMIN" ||
    account?.id === actor.id
  )
    throw badRequest("Este papel de acesso não pode ser alterado por aqui.");
}

async function writeRegistration(
  db: Prisma.TransactionClient,
  { input, current }: Registration,
): Promise<{ id: string; name: string }> {
  const profile = {
    cpf: input.cpf,
    phone: input.phone || null,
    area: input.area,
    jobTitle: input.jobTitle,
    employmentType: input.employmentType ?? null,
  };
  const account = {
    name: input.name,
    email: input.email,
    role: input.role,
    isEnabled: input.isEnabled,
  };
  const notes = input.notes === undefined ? {} : { notes: input.notes };
  const select = { id: true, name: true } as const;
  if (!current)
    return db.user.create({
      data: {
        ...account,
        employeeProfile: { create: profile },
        ...(input.teaches ? { teacherProfile: { create: notes } } : {}),
      },
      select,
    });
  return db.user.update({
    where: { id: current.id },
    data: {
      ...(input.id ? account : {}),
      employeeProfile: { upsert: { create: profile, update: profile } },
      ...(input.teaches ? { teacherProfile: { upsert: { create: notes, update: notes } } } : {}),
    },
    select,
  });
}

export async function saveEmployee(
  db: Prisma.TransactionClient,
  { input, actor }: ActorInput,
): Promise<{ id: string; name: string }> {
  await lockTeacher(db, "");
  const current = await db.user.findFirst({
    where: input.id ? { id: input.id } : { email: { equals: input.email, mode: "insensitive" } },
    select: accountSelect,
  });
  validateRegistration({ input, current });
  validateAccount(current, { input, actor });
  await assertUniqueIdentity({
    database: db,
    values: input,
    ...(current ? { exceptId: current.id } : {}),
  });
  const saved = await writeRegistration(db, { input, current });
  await attachTeacherUploads(db, {
    sessionId: input.documentSessionId,
    ownerId: actor.id,
    teacherId: saved.id,
  });
  return saved;
}
