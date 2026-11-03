import { z } from "zod";
import { calendarDateSchema } from "./calendar.js";
import {
  classFormatSchema,
  classScheduleSlotInputSchema,
  classScheduleSlotsInputSchema,
  classScheduleTypeSchema,
} from "./class.js";

const MAX_PLAN_NAME_LENGTH = 80;
const MAX_SLOTS = 21;
const MAX_PLACEMENTS = 100;
const MAX_LEADS = 100;
const MAX_NOTES_LENGTH = 1200;
const MIN_REASON_LENGTH = 8;

const id = z.string().uuid();
export const semesterScopeSchema = z.object({ semesterId: id }).strict();
export const semesterPlanSchema = semesterScopeSchema
  .extend({
    id: id.optional(),
    version: z.number().int().nonnegative().default(0),
    name: z.string().trim().min(2).max(MAX_PLAN_NAME_LENGTH),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    sharedStageId: id.nullable(),
    teacherId: id.nullable(),
    slots: z.array(classScheduleSlotInputSchema).min(1).max(MAX_SLOTS),
    placements: z
      .array(z.object({ id, version: z.number().int().positive() }))
      .max(MAX_PLACEMENTS)
      .optional(),
    leadIds: z.array(id).max(MAX_LEADS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.id) {
      const schedule = classScheduleSlotsInputSchema.safeParse(value.slots);
      if (!schedule.success)
        for (const issue of schedule.error.issues)
          ctx.addIssue({ code: "custom", path: ["slots", ...issue.path], message: issue.message });
    }
    if ((value.scheduleType === "REGULAR") !== Boolean(value.sharedStageId))
      ctx.addIssue({
        code: "custom",
        path: ["sharedStageId"],
        message: "Turmas regulares exigem estágio compartilhado; PPT usa o estágio de cada aluno.",
      });
    if (
      value.slots.some((slot, index) =>
        value.slots
          .slice(index + 1)
          .some(
            (other) =>
              other.weekday === slot.weekday &&
              other.startTime < slot.endTime &&
              other.endTime > slot.startTime,
          ),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "Os horários da turma se sobrepõem.",
      });
  });
export const semesterPlacementSchema = semesterScopeSchema
  .extend({
    id: id.optional(),
    version: z.number().int().nonnegative().default(0),
    planId: id.nullable(),
    studentId: id,
    stageId: id.nullable(),
    sourceProgressId: id.nullable(),
    effectiveDate: calendarDateSchema.optional(),
    mode: z.enum(["ENTRY", "CONTINUE", "ADVANCE", "REPEAT"]),
    notes: z.string().trim().max(MAX_NOTES_LENGTH).default(""),
  })
  .strict();
export const publishSemesterSchema = z
  .object({
    planId: id,
    version: z.number().int().positive(),
    placements: z
      .array(z.object({ id, version: z.number().int().positive() }).strict())
      .min(1)
      .max(MAX_PLACEMENTS),
  })
  .strict()
  .refine(
    (value) => new Set(value.placements.map((item) => item.id)).size === value.placements.length,
    "Selecione cada aluno uma única vez.",
  );
export const withdrawSemesterSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    reason: z.string().trim().min(MIN_REASON_LENGTH).max(MAX_NOTES_LENGTH),
  })
  .strict();
export type SemesterPlanInput = z.infer<typeof semesterPlanSchema>;
export type SemesterPlacementInput = z.infer<typeof semesterPlacementSchema>;
export type PublishSemesterInput = z.infer<typeof publishSemesterSchema>;
