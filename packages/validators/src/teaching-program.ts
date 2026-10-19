import { z } from "zod";
const key = z.string().trim().min(1).max(120);
const title = z.string().trim().min(1).max(200);
const sequence = z.number().int().positive();
const minutes = z.number().int().min(1).max(1440);
const ordered = { key, sequence };
export const trackAgeGroupSchema = z.enum(["ADULT", "CHILD"]);
export const teachingProgramImportSchema = z
  .object({
    stageId: z.string().uuid(),
    source: z
      .object({ provider: key, reference: z.string().trim().min(1).max(500), revision: key })
      .strict(),
    scheduleType: z.enum(["REGULAR", "PERSONALIZED"]),
    modality: z
      .object({
        code: key,
        name: title,
        weeklyMinutes: z.number().int().min(60).max(1440).multipleOf(60).default(120),
      })
      .strict(),
    lessons: z
      .array(z.object({ ...ordered, title }).strict())
      .min(1)
      .max(500),
    units: z
      .array(z.object({ ...ordered, title }).strict())
      .min(1)
      .max(100),
    teachingHours: z
      .array(z.object({ ...ordered, durationMinutes: z.literal(60) }).strict())
      .min(1)
      .max(1000),
    assessments: z
      .array(z.object({ ...ordered, unitKey: key, title }).strict())
      .min(1)
      .max(200),
    activities: z
      .array(
        z
          .object({
            ...ordered,
            unitKey: key,
            teachingHourKey: key,
            durationMinutes: minutes,
            kind: z.enum(["LESSON", "INTRODUCTION", "REVIEW", "ASSESSMENT", "VIDEO", "ACTIVITY"]),
            title: title.max(160),
            sourceCode: z.string().trim().max(100).nullable(),
            descriptionPending: z.boolean().default(false),
            assessmentKey: key.nullable(),
            lessons: z
              .array(z.object({ key, part: z.string().trim().min(1).max(80).nullable() }).strict())
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(4000),
  })
  .strict();
