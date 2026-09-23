import { civilDateSchema } from "./civil-date.js";
import { z } from "zod";

import { studentStatusSchema } from "./student.js";
import { paginationResultFields, studentPaginationPolicy } from "./pagination.js";

/**
 * Contract for the paginated students listing (`students.list`). The tabs group
 * `INACTIVE | SUSPENDED | DROPPED` under a single "inactive" filter; per-row
 * facts (attendance, finance) are derived server-side so the table renders
 * without any further round trips.
 */

const SEARCH_MAX_LENGTH = 80;
export const STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH = 80;
const MAX_FILTER_IDS = 50;
export const STUDENT_PAGE_SIZE_OPTIONS = studentPaginationPolicy.pageSizeOptions;
export const DEFAULT_STUDENT_PAGE_SIZE = studentPaginationPolicy.defaultPageSize;

export const studentListStatusFilterSchema = z.enum(["all", "active", "inactive"]);

export const studentListInputSchema = z
  .object({
    page: studentPaginationPolicy.pageSchema,
    pageSize: studentPaginationPolicy.pageSizeSchema,
    status: studentListStatusFilterSchema.default("all"),
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    situations: z
      .array(z.enum(["active", "inactive"]))
      .max(2)
      .optional(),
    classIds: z.array(z.string().uuid()).max(MAX_FILTER_IDS).optional(),
    teacherIds: z.array(z.string().uuid()).max(MAX_FILTER_IDS).optional(),
    registeredFrom: civilDateSchema.optional(),
    registeredTo: civilDateSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.registeredFrom || !value.registeredTo || value.registeredFrom <= value.registeredTo,
    { path: ["registeredTo"], message: "O fim deve ser igual ou posterior ao início." },
  );

/** The most recent open enrollment, flattened for the "Turma"/"Professor" columns. */
export const studentListEnrollmentSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    classId: z.string().uuid(),
    classCode: z.string(),
    /** Weekday(s) + start time, e.g. "Seg e Qua · 19:00". */
    scheduleLabel: z.string(),
    teacherName: z.string(),
  })
  .strict();

export const studentListAttendanceSchema = z
  .object({
    /** Fraction in [0, 1], or null when no session has been held ("sem dados"). */
    percent: z.number().nullable(),
    flagged: z.boolean(),
  })
  .strict();

/** "—" (no active order), "Em dia", or the open overdue balance in cents. */
// Stryker disable StringLiteral,ObjectLiteral: changing Zod discriminators aborts schema construction.
export const studentListFinanceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("upToDate") }).strict(),
  z.object({ kind: z.literal("overdue"), overdueCents: z.number().int() }).strict(),
]);
// Stryker restore StringLiteral,ObjectLiteral

export const studentListRowSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string(),
    /** Derived from `birthDate` at read time; never persisted. */
    isMinor: z.boolean(),
    status: studentStatusSchema,
    phone: z.string().nullable(),
    enrollment: studentListEnrollmentSchema.nullable(),
    attendance: studentListAttendanceSchema,
    finance: studentListFinanceSchema,
  })
  .strict();

export const studentListCountsSchema = z
  .object({
    all: z.number().int(),
    active: z.number().int(),
    inactive: z.number().int(),
  })
  .strict();

export const studentListOutputSchema = z
  .object({
    rows: z.array(studentListRowSchema),
    ...paginationResultFields(studentPaginationPolicy),
    /** Tab counts, already narrowed by the current search. */
    counts: studentListCountsSchema,
    /** Header facts, independent of the current filters. */
    totalStudents: z.number().int(),
    activeClasses: z.number().int(),
  })
  .strict();

export type StudentListInput = z.infer<typeof studentListInputSchema>;
export type StudentListOutput = z.infer<typeof studentListOutputSchema>;
export type StudentListRow = z.infer<typeof studentListRowSchema>;
export type StudentListStatusFilter = z.infer<typeof studentListStatusFilterSchema>;
