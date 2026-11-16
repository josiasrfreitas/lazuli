import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { classFormatSchema, timeOfDaySchema } from "./class.js";

const MAX_NOTES_LENGTH = 4000;
const MAX_PERFORMED_MINUTES = 1440;
const MAX_COVERAGES = 20;
const MAX_LIST_SPAN_MS = 8_035_200_000;
const MAX_SEARCH_LENGTH = 160;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const id = z.string().uuid("Selecione um registro válido.");
const note = z.string().trim().max(MAX_NOTES_LENGTH);
export const appointmentPurposeSchema = z.enum([
  "MAKEUP",
  "PPT_COMPLEMENT",
  "REINFORCEMENT",
  "ASSESSMENT",
]);
export const appointmentStatusSchema = z.enum(["SCHEDULED", "ATTENDED", "NO_SHOW", "CANCELLED"]);
export const makeupCoverageSchema = z
  .object({
    attendanceId: id,
    minutes: z
      .number()
      .int("Informe minutos inteiros.")
      .min(1, "Informe pelo menos 1 minuto.")
      .max(MAX_PERFORMED_MINUTES, "Informe até 1.440 minutos."),
  })
  .strict();
export const appointmentMeetingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CLASS"), sessionId: id }).strict(),
  z
    .object({
      kind: z.literal("INDEPENDENT"),
      academicExceptionDate: civilDateSchema.optional(),
      teacherId: id,
      date: civilDateSchema,
      startTime: timeOfDaySchema,
      endTime: timeOfDaySchema,
      format: classFormatSchema,
    })
    .strict(),
]);
export const appointmentScheduleSchema = z
  .object({
    id,
    studentId: id,
    enrollmentId: id.nullable(),
    purpose: appointmentPurposeSchema,
    meeting: appointmentMeetingSchema,
    plannedContent: note,
    notes: note,
    coverages: z.array(makeupCoverageSchema).max(MAX_COVERAGES),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.purpose === "MAKEUP" && value.coverages.length === 0)
      context.addIssue({
        code: "custom",
        path: ["coverages"],
        message: "Selecione pelo menos uma falta de origem.",
      });
    if (value.purpose !== "MAKEUP" && value.coverages.length > 0)
      context.addIssue({
        code: "custom",
        path: ["coverages"],
        message: "Somente reposição de falta pode ter compensação.",
      });
    if (value.purpose === "PPT_COMPLEMENT" && !value.enrollmentId)
      context.addIssue({
        code: "custom",
        path: ["enrollmentId"],
        message: "Selecione a matrícula PPT.",
      });
    if (value.meeting.kind === "INDEPENDENT" && value.meeting.endTime <= value.meeting.startTime)
      context.addIssue({
        code: "custom",
        path: ["meeting", "endTime"],
        message: "O fim deve ser depois do início.",
      });
  });
export const appointmentIdSchema = z.object({ id }).strict();
export const appointmentVersionSchema = appointmentIdSchema.extend({
  expectedVersion: z.number().int().min(0),
});
export const appointmentCancelSchema = appointmentVersionSchema.extend({
  reason: note.min(1, "Informe o motivo."),
});
export const appointmentRescheduleSchema = appointmentCancelSchema.extend({
  replacement: appointmentScheduleSchema,
});
export const appointmentRecordSchema = appointmentVersionSchema
  .extend({
    attended: z.boolean(),
    performedContent: note,
    performedMinutes: z
      .number()
      .int("Informe minutos inteiros.")
      .min(1, "Informe pelo menos 1 minuto.")
      .max(MAX_PERFORMED_MINUTES, "Informe até 1.440 minutos.")
      .nullable(),
    notes: note,
    reason: note,
    coverages: z.array(makeupCoverageSchema).max(MAX_COVERAGES),
  })
  .superRefine((value, context) => {
    if (value.attended && !value.performedContent)
      context.addIssue({
        code: "custom",
        path: ["performedContent"],
        message: "Descreva o conteúdo realizado.",
      });
    if (value.attended && !value.performedMinutes)
      context.addIssue({
        code: "custom",
        path: ["performedMinutes"],
        message: "Informe os minutos realizados.",
      });
    if (!value.attended && value.coverages.length > 0)
      context.addIssue({
        code: "custom",
        path: ["coverages"],
        message: "Sem comparecimento não há compensação.",
      });
  });
export const appointmentListSchema = z
  .object({
    from: civilDateSchema,
    through: civilDateSchema,
    studentId: id.optional(),
    teacherId: id.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.through >= value.from &&
      new Date(value.through).getTime() - new Date(value.from).getTime() <= MAX_LIST_SPAN_MS,
    { message: "Consulte um período de até 93 dias." },
  );
export const appointmentStudentSchema = z
  .object({ studentId: id, excludeAppointmentId: id.optional() })
  .strict();
export const absenceListSchema = z
  .object({
    from: civilDateSchema,
    through: civilDateSchema,
    search: z.string().trim().max(MAX_SEARCH_LENGTH).default(""),
    onlyOpen: z.boolean().default(true),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict()
  .refine((value) => value.through >= value.from, { message: "Informe um período válido." });
export type AppointmentScheduleInput = z.infer<typeof appointmentScheduleSchema>;
export type AppointmentRecordInput = z.infer<typeof appointmentRecordSchema>;
export type AppointmentMeetingInput = z.infer<typeof appointmentMeetingSchema>;
export type MakeupCoverageInput = z.infer<typeof makeupCoverageSchema>;

const person = z.object({ id, name: z.string() });
export const appointmentSnapshotSchema = z.object({
  id,
  version: z.number().int().min(0),
  student: person,
  teacher: person.nullable(),
  enrollmentId: id.nullable(),
  targetClassSessionId: id.nullable(),
  targetClassName: z.string().nullable(),
  legacyMakeupId: id.nullable(),
  rescheduledFromId: id.nullable(),
  purpose: appointmentPurposeSchema,
  status: appointmentStatusSchema,
  format: classFormatSchema,
  date: civilDateSchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  plannedContent: z.string().nullable(),
  performedContent: z.string().nullable(),
  performedMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
  scheduledAt: z.string().datetime(),
  scheduledBy: person.nullable(),
  recordedAt: z.string().datetime().nullable(),
  recordedBy: person.nullable(),
  cancelledAt: z.string().datetime().nullable(),
  cancelledBy: person.nullable(),
  cancellationReason: z.string().nullable(),
  coverages: z.array(
    z.object({
      attendanceId: id,
      minutes: z.number().int().positive(),
      enrollmentId: id,
      sourceSessionId: id,
      sourceClassId: id,
      sourceClassName: z.string(),
      date: civilDateSchema,
      startTime: timeOfDaySchema,
      endTime: timeOfDaySchema,
      sourceStatus: z.enum(["PRESENT", "ABSENT"]),
      applicable: z.boolean(),
    }),
  ),
});
export type AppointmentSnapshot = z.infer<typeof appointmentSnapshotSchema>;
