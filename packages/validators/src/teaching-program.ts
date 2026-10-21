import { z } from "zod";
const MAX_KEY = 120;
const MAX_TITLE = 200;
const MAX_MINUTES = 1440;
const MAX_SOURCE_REFERENCE = 500;
const HOUR_MINUTES = 60;
const DEFAULT_WEEKLY_MINUTES = 120;
const MAX_LESSONS = 500;
const MAX_UNITS = 100;
const MAX_TEACHING_HOURS = 1000;
const MAX_ASSESSMENTS = 200;
const MAX_ACTIVITY_TITLE = 160;
const MAX_SOURCE_CODE = 100;
const MAX_LESSON_PART = 80;
const MAX_ACTIVITY_LESSONS = 20;
const MAX_ACTIVITIES = 4000;

const key = z.string().trim().min(1).max(MAX_KEY);
const title = z.string().trim().min(1).max(MAX_TITLE);
const sequence = z.number().int().positive();
const minutes = z.number().int().min(1).max(MAX_MINUTES);
const ordered = { key, sequence };
export const trackAgeGroupSchema = z.enum(["ADULT", "CHILD"]);
export const teachingProgramImportSchema = z
  .object({
    stageId: z.string().uuid(),
    source: z
      .object({
        provider: key,
        reference: z.string().trim().min(1).max(MAX_SOURCE_REFERENCE),
        revision: key,
      })
      .strict(),
    scheduleType: z.enum(["REGULAR", "PERSONALIZED"]),
    modality: z
      .object({
        code: key,
        name: title,
        weeklyMinutes: z
          .number()
          .int()
          .min(HOUR_MINUTES)
          .max(MAX_MINUTES)
          .multipleOf(HOUR_MINUTES)
          .default(DEFAULT_WEEKLY_MINUTES),
      })
      .strict(),
    lessons: z
      .array(z.object({ ...ordered, title }).strict())
      .min(1)
      .max(MAX_LESSONS),
    units: z
      .array(z.object({ ...ordered, title }).strict())
      .min(1)
      .max(MAX_UNITS),
    teachingHours: z
      .array(z.object({ ...ordered, durationMinutes: z.literal(HOUR_MINUTES) }).strict())
      .min(1)
      .max(MAX_TEACHING_HOURS),
    assessments: z
      .array(z.object({ ...ordered, unitKey: key, title }).strict())
      .min(1)
      .max(MAX_ASSESSMENTS),
    activities: z
      .array(
        z
          .object({
            ...ordered,
            unitKey: key,
            teachingHourKey: key,
            durationMinutes: minutes,
            kind: z.enum(["LESSON", "INTRODUCTION", "REVIEW", "ASSESSMENT", "VIDEO", "ACTIVITY"]),
            title: title.max(MAX_ACTIVITY_TITLE),
            sourceCode: z.string().trim().max(MAX_SOURCE_CODE).nullable(),
            descriptionPending: z.boolean().default(false),
            assessmentKey: key.nullable(),
            lessons: z
              .array(
                z
                  .object({ key, part: z.string().trim().min(1).max(MAX_LESSON_PART).nullable() })
                  .strict(),
              )
              .max(MAX_ACTIVITY_LESSONS),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ACTIVITIES),
  })
  .strict();
