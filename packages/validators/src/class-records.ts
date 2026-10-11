import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { stagePlanSnapshotSchema } from "./stage-planning.js";
const dateOnly = civilDateSchema;
export const classRecordContentSchema = z
  .object({
    kind: z.enum(["CONTENT", "REVIEW", "ASSESSMENT", "ACTIVITY"]),
    account: z.string().trim().min(3, "Descreva o que foi realizado.").max(2000),
    reference: z.string().trim().max(200).nullable(),
    pageFrom: z.number().int().min(1).max(10000).nullable(),
    pageTo: z.number().int().min(1).max(10000).nullable(),
  })
  .strict()
  .refine(
    (value) => value.pageTo === null || (value.pageFrom !== null && value.pageTo >= value.pageFrom),
    { path: ["pageTo"], message: "Informe um intervalo de páginas válido." },
  );
export const classRecordSaveSchema = z
  .object({
    sessionId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    attendanceStamp: z.string().datetime().nullable(),
    rows: z
      .array(
        z
          .object({
            enrollmentId: z.string().uuid(),
            status: z.enum(["PRESENT", "ABSENT"]),
            content: classRecordContentSchema.nullable(),
          })
          .strict(),
      )
      .max(500),
    sharedContent: classRecordContentSchema.nullable(),
    note: z.string().trim().max(2000).nullable(),
    reason: z.string().trim().min(3, "Explique o motivo da correção.").max(1000).optional(),
  })
  .strict()
  .refine((value) => value.version === 0 || Boolean(value.reason), {
    path: ["reason"],
    message: "Explique o motivo da correção.",
  });
export const classRecordListSchema = z
  .object({ from: dateOnly, to: dateOnly, classId: z.string().uuid().optional() })
  .strict()
  .refine(
    (value) =>
      value.to >= value.from &&
      new Date(value.to).getTime() - new Date(value.from).getTime() <= 31 * 86400000,
    { message: "Escolha um período de até 31 dias." },
  );
const plannedSchema = z
  .object({
    planId: z.string().uuid(),
    revisionId: z.string().uuid(),
    version: z.number().int().positive(),
    items: stagePlanSnapshotSchema.shape.items,
  })
  .nullable();
export const classRecordSnapshotSchema = z.object({
  note: z.string().nullable(),
  sharedContent: classRecordContentSchema.nullable(),
  sharedPlanned: plannedSchema,
  entries: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      studentId: z.string().uuid(),
      name: z.string(),
      progressId: z.string().uuid().nullable(),
      stage: z.string().nullable(),
      status: z.enum(["PRESENT", "ABSENT"]),
      content: classRecordContentSchema.nullable(),
      planned: plannedSchema,
    }),
  ),
});
export type ClassRecordContent = z.infer<typeof classRecordContentSchema>;
export type ClassRecordSnapshot = z.infer<typeof classRecordSnapshotSchema>;
export type ClassRecordSave = z.infer<typeof classRecordSaveSchema>;
