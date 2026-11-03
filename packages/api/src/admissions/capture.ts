import type { Prisma } from "@lazuli/db";
import type { leadCaptureSchema, z } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { lockCandidate, readCandidate } from "./candidates.js";
import { assertInitialStage } from "./catalog.js";
type Database = Prisma.TransactionClient;
type Context = { database: Database; recordedById: string; now: Date };
type LeadValues = z.infer<typeof leadCaptureSchema>;
type CaptureFields = Omit<
  LeadValues,
  "id" | "birthDate" | "notes" | "stageId" | "phone" | "email" | "contactName" | "source"
> & {
  birthDate: Date | null;
  notes?: string | null;
  stageId: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  source: string | null;
};
export async function captureLead(
  input: Context & { values: z.infer<typeof leadCaptureSchema> },
): Promise<{ id: string }> {
  const { values, database } = input;
  await lockCandidate(database, values.id);
  const existing = await database.admissionCandidate.findUnique({ where: { id: values.id } });
  if (existing) return { id: existing.id };
  const fields = await captureFields(input);
  return database.admissionCandidate.create({
    data: {
      id: values.id,
      ...fields,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}
export async function updateLeadDetails(
  input: Context & { values: z.infer<typeof leadCaptureSchema> },
): Promise<{ id: string }> {
  const { database, values } = input;
  await lockCandidate(database, values.id);
  const lead = await readCandidate(database, values.id);
  if (lead.status !== "WAITING") throw badRequest("Reabra o lead antes de alterar os dados.");
  const fields = await captureFields(input, lead);
  return database.admissionCandidate.update({
    where: { id: values.id },
    data: {
      ...fields,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });
}

async function captureFields(
  input: Context & { values: z.infer<typeof leadCaptureSchema> },
  previous?: { englishExperience: string; stageId: string | null },
): Promise<CaptureFields> {
  const { birthDate, englishExperience, stageId } = input.values;
  const today = saoPauloDateOnly(input.now);
  if (birthDate && birthDate > today) throw badRequest("O nascimento não pode estar no futuro.");
  if (englishExperience === "NONE") await assertInitialStage(input.database, stageId);
  return normalizedLeadFields(input.values, previous);
}

function normalizedLeadFields(
  values: LeadValues,
  previous?: { englishExperience: string; stageId: string | null },
): CaptureFields {
  const { id: _id, birthDate, notes, ...fields } = values;
  return {
    ...fields,
    stageId: captureStageId(values, previous),
    phone: fields.phone || null,
    email: fields.email || null,
    contactName: fields.contactName || null,
    source: fields.source || null,
    ...(notes === undefined ? {} : { notes: notes || null }),
    birthDate: birthDate ? new Date(birthDate) : null,
  };
}

function captureStageId(
  fields: LeadValues,
  previous?: { englishExperience: string; stageId: string | null },
): string | null {
  if (fields.englishExperience !== "SOME") return fields.stageId;
  return previous?.englishExperience === "SOME" ? previous.stageId : null;
}
