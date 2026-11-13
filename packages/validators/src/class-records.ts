import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { stagePlanSnapshotSchema } from "./stage-planning.js";
const MIN_TEXT_LENGTH = 3;
const MAX_TEXT_LENGTH = 2000;
const MAX_REFERENCE_LENGTH = 200;
const MAX_PAGE = 10_000;
// Recorded labels include the canonical title and its lesson context.
const MAX_TITLE_LENGTH = 500;
const MAX_ROSTER_SIZE = 500;
const MAX_REASON_LENGTH = 1000;
const MAX_QUERY_DAYS = 31;
const MILLISECONDS_PER_DAY = 86_400_000;
const dateOnly = civilDateSchema;
export const classRecordContentSchema = z
  .object({
    kind: z.enum(["CONTENT", "REVIEW", "ASSESSMENT", "ACTIVITY"]),
    account: z
      .string()
      .trim()
      .min(MIN_TEXT_LENGTH, "Descreva o que foi realizado.")
      .max(MAX_TEXT_LENGTH),
    reference: z.string().trim().max(MAX_REFERENCE_LENGTH).nullable(),
    pageFrom: z.number().int().min(1).max(MAX_PAGE).nullable(),
    pageTo: z.number().int().min(1).max(MAX_PAGE).nullable(),
    planItems: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            status: z.enum(["PARTIAL", "COMPLETED"]),
            title: z.string().max(MAX_TITLE_LENGTH).optional(),
          })
          .strict(),
      )
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        "Não repita atividades no registro.",
      )
      .optional(),
    planItemId: z.string().uuid().nullable().optional(),
    planItemStatus: z.enum(["PARTIAL", "COMPLETED"]).optional(),
    planItemTitle: z.string().max(MAX_TITLE_LENGTH).optional(),
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
    qrReviewed: z.boolean().optional(),
    declarationIds: z.array(z.string().uuid()).max(MAX_ROSTER_SIZE).optional(),
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
      .max(MAX_ROSTER_SIZE),
    sharedContent: classRecordContentSchema.nullable(),
    note: z.string().trim().max(MAX_TEXT_LENGTH).nullable(),
    reason: z
      .string()
      .trim()
      .min(MIN_TEXT_LENGTH, "Explique o motivo da correção.")
      .max(MAX_REASON_LENGTH)
      .optional(),
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
      new Date(value.to).getTime() - new Date(value.from).getTime() <=
        MAX_QUERY_DAYS * MILLISECONDS_PER_DAY,
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
const attendanceAuthor = z.object({ id: z.string().uuid(), name: z.string() }).nullable();
export const classRecordSnapshotSchema = z.object({
  attendanceOrigin: z
    .object({
      confirmedBy: attendanceAuthor,
      confirmedAt: z.string().datetime().nullable().optional(),
      priorState: z.boolean().default(true),
      entries: z.array(
        z.object({
          enrollmentId: z.string().uuid(),
          recordedBy: attendanceAuthor,
          recordedAt: z.string().datetime(),
          modifiedBy: attendanceAuthor,
          modifiedAt: z.string().datetime().nullable(),
        }),
      ),
    })
    .optional(),
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
