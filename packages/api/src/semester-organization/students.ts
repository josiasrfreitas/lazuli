import { searchMatchKysely } from "../search.js";
import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { OrganizationContext } from "./data.js";
import { notFound } from "../trpc/errors.js";

const PAGE_SIZE = 25;
const STUDENT_ID = "student.id";

export async function organizationStudents(
  context: OrganizationContext,
  input: { semesterId: string; search: string; page: number; unassigned: boolean },
) {
  const today = new Date(saoPauloDateOnly(context.now));
  let base = context.database.$kysely
    .selectFrom("Student as student")
    .where("student.deleted_at", "is", null)
    .where(searchMatchKysely(sql.ref("student.full_name"), input.search));
  if (input.unassigned)
    base = base.where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("SemesterPlacement as placement")
            .select("placement.id")
            .whereRef("placement.student_id", "=", STUDENT_ID)
            .where("placement.semester_id", "=", input.semesterId)
            .where("placement.deleted_at", "is", null),
        ),
      ),
    );
  const [total, rows] = await Promise.all([
    base.select(sql<number>`count(*)::int`.as("count")).executeTakeFirstOrThrow(),
    base
      .select([STUDENT_ID, "student.full_name as name", "student.status"])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom("Enrollment as enrollment")
            .innerJoin("PedagogicalProgress as progress", "progress.enrollment_id", "enrollment.id")
            .innerJoin("Stage as stage", "stage.id", "progress.stage_id")
            .innerJoin("Class as class", "class.id", "enrollment.class_id")
            .select([
              "progress.id",
              "stage.internal_code as stageCode",
              "class.portal_class_name as className",
              "class.schedule_type as scheduleType",
            ])
            .whereRef("enrollment.student_id", "=", STUDENT_ID)
            .where("enrollment.deleted_at", "is", null)
            .where("progress.deleted_at", "is", null)
            .where("enrollment.entry_date", "<=", today)
            .where("progress.start_date", "<=", today)
            .where((eb) =>
              eb.or([
                eb("enrollment.exit_date", "is", null),
                eb("enrollment.exit_date", ">", today),
              ]),
            )
            .where((eb) =>
              eb.or([eb("progress.end_date", "is", null), eb("progress.end_date", ">=", today)]),
            ),
        ).as("current"),
      )
      .orderBy("student.full_name")
      .orderBy(STUDENT_ID)
      .offset((input.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .execute(),
  ]);
  return { rows, total: total.count, page: input.page, pageSize: 25 };
}
type OrganizationStudentOptions = { studentId: string; semesterId: string };

export async function organizationStudent(
  context: OrganizationContext,
  options: OrganizationStudentOptions,
) {
  const { studentId, semesterId } = options;

  const today = new Date(saoPauloDateOnly(context.now));
  const student = await context.database.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, status: true },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  const [progress, availability, previousAvailability, lead] = await Promise.all([
    context.database.pedagogicalProgress.findMany({
      where: {
        deletedAt: null,
        endDate: null,
        startDate: { lte: today },
        enrollment: { studentId, deletedAt: null, exitDate: null, entryDate: { lte: today } },
      },
      include: {
        stage: {
          include: {
            track: {
              include: { stages: { where: { deletedAt: null }, orderBy: { sequence: "asc" } } },
            },
          },
        },
        enrollment: { include: { class: true } },
        assessment: { select: { decision: true, confirmedAt: true } },
        stagePlan: { select: { plannedEndOn: true } },
      },
    }),
    context.database.studentAvailability.findMany({
      where: { studentId, semesterId },
      include: { recordedBy: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    }),
    context.database.studentAvailability.findFirst({
      where: { studentId, semesterId: { not: semesterId }, confirmed: true },
      orderBy: { createdAt: "desc" },
    }),
    context.database.admissionCandidate.findFirst({
      where: { studentId, deletedAt: null },
      include: { availability: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { student, progress, availability, previousAvailability, lead };
}
