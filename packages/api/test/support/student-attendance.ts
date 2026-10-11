import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanEnrollmentFixtures,
  ensureTeacherFor,
  createStudentFor,
  seedTwoStageCatalogFor,
  createRegularClassFor,
  ENROLLMENT_ADMIN_ID,
} from "./enrollment/fixtures.js";
export const attendanceConfig = {
  prefix: "Declare182 ",
  catalogKey: "declare182",
  catalogKeyPrefix: "declare182",
  teacherId: "00000000-0000-0000-0000-000000001820",
  teacherEmail: "declare182@example.com",
  teacherName: "Declaration Teacher",
  semesterName: "Declare182 2077.1",
  semesterStart: "2077-02-01",
  semesterEnd: "2077-06-30",
};
export const declarationAdmin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  name: "Coordenação",
  email: "admin@example.com",
  isEnabled: true,
  role: "ADMIN",
};
export const declarationTeacher: StaffUser = {
  ...declarationAdmin,
  id: attendanceConfig.teacherId,
  name: attendanceConfig.teacherName,
  role: "TEACHER",
};
export const declarationCaller = (
  now = "2077-03-10T12:05:00Z",
  staffUser: StaffUser | null = declarationAdmin,
) => createCaller({ db, staffUser, now: new Date(now) });
export async function cleanDeclarations() {
  const classWhere = { internalCode: { startsWith: attendanceConfig.prefix } };
  await db.attendanceDeclaration.deleteMany({ where: { classSession: { class: classWhere } } });
  await db.attendanceWindow.deleteMany({ where: { classSession: { class: classWhere } } });
  await db.classSessionRecordRevision.deleteMany({
    where: { record: { classSession: { class: classWhere } } },
  });
  await db.classSessionRecord.deleteMany({ where: { classSession: { class: classWhere } } });
  await db.classSubstitution.deleteMany({ where: { class: classWhere } });
  await db.activityEvent.deleteMany({
    where: { subjectName: { startsWith: attendanceConfig.prefix } },
  });
  await cleanEnrollmentFixtures(attendanceConfig);
}
export async function declarationFixture(online = false) {
  await ensureTeacherFor(attendanceConfig);
  const catalog = await seedTwoStageCatalogFor(attendanceConfig);
  const group = await createRegularClassFor(attendanceConfig, {
    code: "A",
    semesterId: catalog.semesterId,
    sharedStageId: catalog.firstStageId,
  });
  if (online) await db.class.update({ where: { id: group.id }, data: { format: "ONLINE" } });
  const students = [];
  for (const suffix of ["Ana Silva", "Bia Silva"]) {
    const student = await createStudentFor(attendanceConfig, { suffix });
    const result = await declarationCaller("2077-02-01T12:00:00Z").enrollment.create({
      studentId: student.id,
      classId: group.id,
    });
    students.push({
      studentId: student.id,
      enrollmentId: result.enrollment.id,
      name: `${attendanceConfig.prefix}${suffix}`,
    });
  }
  const session = await db.classSession.create({
    data: {
      classId: group.id,
      date: new Date("2077-03-10"),
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T10:00:00Z"),
    },
  });
  return { session, group, students };
}
