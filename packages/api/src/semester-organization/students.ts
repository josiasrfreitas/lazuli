import { searchMatchKysely } from "../search.js";
import { sql, type RawBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { OrganizationContext } from "./data.js";
import { notFound } from "../trpc/errors.js";
import type { Prisma } from "@lazuli/db";

const PAGE_SIZE = 25;
const STUDENT_ID = "student.id";
type StudentModel = Prisma.StudentGetPayload<Prisma.StudentDefaultArgs>;
type ClassModel = Prisma.ClassGetPayload<Prisma.ClassDefaultArgs>;
type StudentListRow = {
  id: string;
  name: string;
  status: StudentModel["status"];
  current: Array<{
    id: string;
    stageCode: string;
    className: string;
    scheduleType: ClassModel["scheduleType"];
  }>;
};
type StudentList = { rows: StudentListRow[]; total: number; page: number; pageSize: number };
const progressInclude = {
  stage: {
    include: {
      track: { include: { stages: { where: { deletedAt: null }, orderBy: { sequence: "asc" } } } },
    },
  },
  enrollment: { include: { class: true } },
  assessment: { select: { decision: true, confirmedAt: true } },
  stagePlan: { select: { plannedEndOn: true } },
} satisfies Prisma.PedagogicalProgressInclude;
type Progress = Prisma.PedagogicalProgressGetPayload<{ include: typeof progressInclude }>;
type Availability = Prisma.StudentAvailabilityGetPayload<{
  include: { recordedBy: { select: { name: true } } };
}>;
type PreviousAvailability =
  Prisma.StudentAvailabilityGetPayload<Prisma.StudentAvailabilityDefaultArgs>;
type Lead = Prisma.AdmissionCandidateGetPayload<{ include: { availability: true } }>;
type StudentDetail = {
  student: Pick<StudentModel, "id" | "fullName" | "status">;
  progress: Progress[];
  availability: Availability[];
  previousAvailability: PreviousAvailability | null;
  lead: Lead | null;
};

export async function organizationStudents(
  context: OrganizationContext,
  input: { semesterId: string; search: string; page: number; unassigned: boolean },
): Promise<StudentList> {
  const today = new Date(saoPauloDateOnly(context.now));
  let base = context.database.$kysely
    .selectFrom("Student as student")
    .where("student.deleted_at", "is", null)
    .where(searchMatchKysely(sql.ref("student.full_name"), input.search));
  if (input.unassigned) base = base.where(unassignedStudent(input.semesterId));
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
            .where(sql<boolean>`(enrollment.exit_date IS NULL OR enrollment.exit_date > ${today})`)
            .where(sql<boolean>`(progress.end_date IS NULL OR progress.end_date >= ${today})`),
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

function unassignedStudent(semesterId: string): RawBuilder<boolean> {
  return sql<boolean>`
    NOT EXISTS (
        SELECT 1 FROM "SemesterPlacement" AS placement
        WHERE placement.student_id = student.id
          AND placement.semester_id = ${semesterId}::uuid
          AND placement.deleted_at IS NULL
      )
  `;
}
type OrganizationStudentOptions = { studentId: string; semesterId: string };

export async function organizationStudent(
  context: OrganizationContext,
  options: OrganizationStudentOptions,
): Promise<StudentDetail> {
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
      include: progressInclude,
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
