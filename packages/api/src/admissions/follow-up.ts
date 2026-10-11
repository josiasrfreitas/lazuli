import type { Prisma } from "@lazuli/db";
import type {
  leadCaptureSchema,
  leadContactSchema,
  leadNextStepSchema,
  z,
} from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockCandidate, readCandidate } from "./candidates.js";
type Database = Prisma.TransactionClient;
type Context = { database: Database; recordedById: string; now: Date };
export async function captureLead(
  input: Context & { values: z.infer<typeof leadCaptureSchema> },
): Promise<{ id: string }> {
  const { values, database } = input;
  await lockCandidate(database, values.id);
  const existing = await database.admissionCandidate.findUnique({ where: { id: values.id } });
  if (existing) return { id: existing.id };
  return database.admissionCandidate.create({
    data: {
      ...values,
      phone: values.phone || null,
      email: values.email || null,
      contactName: values.contactName || null,
      source: values.source || null,
      availabilityConfirmedAt: null,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}
export async function setLeadNextStep(
  input: Context & { values: z.infer<typeof leadNextStepSchema> },
): Promise<{ id: string }> {
  const { values, database } = input;
  await lockCandidate(database, values.id);
  const candidate = await readCandidate(database, values.id);
  if (candidate.status !== "WAITING")
    throw badRequest("Reabra o lead para definir um próximo passo.");
  if (values.nextActionOn && values.nextActionOn < saoPauloDateOnly(input.now))
    throw badRequest("Agende o retorno para hoje ou uma data futura.");
  if (values.ownerId) {
    const owner = await database.user.findFirst({
      where: { id: values.ownerId, isEnabled: true, role: { in: ["ADMIN", "SYSTEM_ADMIN"] } },
    });
    if (!owner) throw notFound("Responsável pelo acompanhamento não encontrado.");
  }
  return database.admissionCandidate.update({
    where: { id: values.id },
    data: {
      ownerId: values.ownerId,
      nextAction: values.nextAction || null,
      nextActionOn: values.nextActionOn ? new Date(values.nextActionOn) : null,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}
export async function recordLeadContact(
  input: Context & { values: z.infer<typeof leadContactSchema> },
): Promise<{ id: string }> {
  const { database, values } = input;
  await lockCandidate(database, values.candidateId);
  const lead = await readCandidate(database, values.candidateId);
  if (lead.status !== "WAITING") throw badRequest("Reabra o lead antes de registrar um contato.");
  if (values.contactedOn > saoPauloDateOnly(input.now))
    throw badRequest("O contato não pode estar no futuro.");
  const existing = await database.leadContact.findUnique({ where: { id: values.id } });
  if (existing) {
    if (existing.candidateId !== values.candidateId)
      throw badRequest("Este registro já pertence a outro lead.");
    return { id: existing.id };
  }
  return database.leadContact.create({
    data: {
      ...values,
      contactedOn: new Date(values.contactedOn),
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}
export function leadContacts(
  database: Database,
  candidateId: string,
): Promise<
  Array<{ id: string; contactedOn: Date; summary: string; recordedBy: { name: string } }>
> {
  return database.leadContact.findMany({
    where: { candidateId, deletedAt: null },
    select: { id: true, contactedOn: true, summary: true, recordedBy: { select: { name: true } } },
    orderBy: [{ contactedOn: "desc" }, { createdAt: "desc" }],
  });
}
export async function updateLeadDetails(
  input: Context & { values: z.infer<typeof leadCaptureSchema> },
): Promise<{ id: string }> {
  const { database, values } = input;
  await lockCandidate(database, values.id);
  const lead = await readCandidate(database, values.id);
  if (lead.status !== "WAITING") throw badRequest("Reabra o lead antes de alterar os dados.");
  const { id, ...fields } = values;
  return database.admissionCandidate.update({
    where: { id },
    data: {
      ...fields,
      phone: fields.phone || null,
      email: fields.email || null,
      contactName: fields.contactName || null,
      source: fields.source || null,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}
