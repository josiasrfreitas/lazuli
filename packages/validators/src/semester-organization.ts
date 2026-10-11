import { z } from "zod";
import { calendarDateSchema } from "./calendar.js";
import {
  classFormatSchema,
  classScheduleSlotInputSchema,
  classScheduleSlotsInputSchema,
  classScheduleTypeSchema,
} from "./class.js";

const id = z.string().uuid();
export const semesterScopeSchema = z.object({ semesterId: id }).strict();
export const semesterPlanSchema = semesterScopeSchema
  .extend({
    id: id.optional(),
    version: z.number().int().nonnegative().default(0),
    name: z.string().trim().min(2).max(80),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    sharedStageId: id.nullable(),
    teacherId: id.nullable(),
    slots: classScheduleSlotsInputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
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
    mode: z.enum(["ENTRY", "CONTINUE", "ADVANCE", "REPEAT"]),
    notes: z.string().trim().max(1200).default(""),
  })
  .strict();
export const studentAvailabilitySchema = semesterScopeSchema
  .extend({
    studentId: id,
    previousId: id.nullable(),
    validUntil: calendarDateSchema,
    formats: z.array(classFormatSchema).min(1).max(2),
    slots: z.array(classScheduleSlotInputSchema).min(1).max(21),
    notes: z.string().trim().max(1200).default(""),
  })
  .strict();
export const invalidateAvailabilitySchema = semesterScopeSchema
  .extend({
    studentId: id,
    previousId: id,
    reason: z.string().trim().min(8).max(1200),
  })
  .strict();
export const publishSemesterSchema = z
  .object({
    planId: id,
    version: z.number().int().positive(),
    placements: z
      .array(z.object({ id, version: z.number().int().positive() }).strict())
      .min(1)
      .max(100),
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
    reason: z.string().trim().min(8).max(1200),
  })
  .strict();
export type SemesterPlanInput = z.infer<typeof semesterPlanSchema>;
export type SemesterPlacementInput = z.infer<typeof semesterPlacementSchema>;
export type StudentAvailabilityInput = z.infer<typeof studentAvailabilitySchema>;
export type PublishSemesterInput = z.infer<typeof publishSemesterSchema>;
