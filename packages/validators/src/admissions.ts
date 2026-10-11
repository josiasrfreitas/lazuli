import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import {
  classFormatSchema,
  classScheduleTypeSchema,
  classScheduleSlotInputSchema,
  timeOfDaySchema,
} from "./class.js";
import { studentCreateInputSchema } from "./student.js";

const MAX_NAME = 160;
const MAX_NOTES = 2000;
const MAX_WINDOWS = 28;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const contact = z.string().trim().max(MAX_NAME).nullable();
export const admissionIdSchema = z.object({ id: z.string().uuid() }).strict();
export const admissionValuesSchema = z
  .object({
    fullName: z.string().trim().min(1, "Informe o nome.").max(MAX_NAME),
    phone: contact,
    email: z
      .union([z.string().trim().email("Informe um e-mail válido."), z.literal("")])
      .nullable(),
    notes: z.string().trim().max(MAX_NOTES).nullable(),
    studentId: z.string().uuid().nullable(),
    stageId: z.string().uuid().nullable(),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    availableUntil: civilDateSchema,
    availability: z
      .array(classScheduleSlotInputSchema)
      .min(1, "Informe a disponibilidade.")
      .max(MAX_WINDOWS),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.phone && !value.email)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Informe telefone ou e-mail de contato.",
      });
  });
export const admissionSaveSchema = z
  .object({ id: z.string().uuid(), values: admissionValuesSchema })
  .strict();
export const admissionListSchema = z
  .object({
    search: z.string().trim().max(MAX_NAME).default(""),
    status: z.enum(["WAITING", "ENROLLED", "ARCHIVED", "ALL"]).default("WAITING"),
    expiredOnly: z.boolean().default(false),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();
export const admissionMatchesSchema = admissionIdSchema.extend({ date: civilDateSchema });
export const entryVisitScheduleSchema = z
  .object({
    id: z.string().uuid(),
    candidateId: z.string().uuid(),
    date: civilDateSchema,
    previousVisitId: z.string().uuid().optional(),
    notes: z.string().trim().max(MAX_NOTES).default(""),
    meeting: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("TRIAL"),
          classId: z.string().uuid(),
          scheduleSlotId: z.string().uuid().nullable(),
          classSessionId: z.string().uuid().nullable(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("INTRODUCTION"),
          teacherId: z.string().uuid(),
          startTime: timeOfDaySchema,
          endTime: timeOfDaySchema,
          format: classFormatSchema,
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.meeting.kind === "INTRODUCTION" && value.meeting.startTime >= value.meeting.endTime)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meeting", "endTime"],
        message: "O término deve ser posterior ao início.",
      });
    if (
      value.meeting.kind === "TRIAL" &&
      !value.meeting.scheduleSlotId &&
      !value.meeting.classSessionId
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meeting"],
        message: "Escolha um encontro da turma.",
      });
  });
export const entryVisitOutcomeSchema = admissionIdSchema
  .extend({
    status: z.enum(["ATTENDED", "ABSENT", "CANCELLED"]),
    notes: z.string().trim().max(MAX_NOTES).default(""),
  })
  .superRefine((value, context) => {
    if (value.status === "CANCELLED" && !value.notes)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Informe o motivo do cancelamento.",
      });
  });
export const admissionEnrollSchema = admissionMatchesSchema
  .extend({
    classId: z.string().uuid(),
    student: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("existing"), id: z.string().uuid() }).strict(),
      z.object({ mode: z.literal("create"), values: studentCreateInputSchema }).strict(),
    ]),
  })
  .strict();

export const entryVisitGuestsSchema = z
  .object({
    classId: z.string().uuid(),
    date: civilDateSchema,
    scheduleSlotId: z.string().uuid().nullable(),
    classSessionId: z.string().uuid().nullable(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.scheduleSlotId) !== Boolean(value.classSessionId),
    "Informe um único encontro.",
  );
