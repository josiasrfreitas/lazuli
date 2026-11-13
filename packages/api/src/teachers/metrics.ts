import type { Prisma } from "@lazuli/db";
import { readStudentHealthBatch } from "@lazuli/db/student-health-batch";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  responsibilitySelect,
  teacherResponsibilityPeriods,
  usualTeacherOn,
} from "./responsibility.js";
import { mean, studentMean, inWindow, absenceSummary } from "./metric-rules.js";
import { metricAttendance } from "./metrics-attendance.js";
import { readTeacher } from "./read.js";

/** Current-cohort monitoring; the health aggregate is not a causal teacher rating. */
export async function teacherMetrics(
  database: Prisma.TransactionClient,
  input: { teacherId: string; now: Date },
) {
  await readTeacher(database, input.teacherId);
  const today = new Date(saoPauloDateOnly(input.now));
  const groups = await database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      OR: [
        { teacherId: input.teacherId },
        { teacherAssignments: { some: { teacherId: input.teacherId, supersededAt: null } } },
      ],
    },
    select: {
      ...responsibilitySelect,
      id: true,
      portalClassName: true,
      scheduleType: true,
      sharedStage: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      semester: { select: { startDate: true, endDate: true, name: true } },
      enrollments: {
        where: {
          deletedAt: null,
          entryDate: { lte: today },
          OR: [{ exitDate: null }, { exitDate: { gt: today } }],
          student: { deletedAt: null },
          actions: {
            none: {
              status: "SCHEDULED",
              kind: { in: ["PAUSE", "EXIT"] },
              effectiveDate: { lte: today },
            },
          },
        },
        select: {
          id: true,
          classId: true,
          studentId: true,
          entryDate: true,
          exitDate: true,
          student: { select: { fullName: true } },
          progressRecords: {
            where: { deletedAt: null, startDate: { lte: today } },
            select: {
              startDate: true,
              endDate: true,
              stage: { select: { id: true, name: true } },
              assessment: {
                select: {
                  id: true,
                  deletedAt: true,
                  grades: {
                    where: { deletedAt: null, assessedOn: { lte: today } },
                    select: {
                      id: true,
                      score: true,
                      assessedOn: true,
                      phase: true,
                      competence: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const classes = groups.filter((group) => usualTeacherOn(group, today)?.id === input.teacherId);
  const students = new Map(
    classes.flatMap((group) =>
      group.enrollments.map((row) => [row.studentId, row.student.fullName] as const),
    ),
  );
  const health = await readStudentHealthBatch({
    database,
    ids: [...students.keys()],
    now: input.now,
  });
  const byStudent = new Map(health.map((row) => [row.studentId, row]));
  const from = classes.length
    ? new Date(Math.min(...classes.map((row) => row.semester.startDate.getTime())))
    : today;
  const attendanceEvidence = await metricAttendance(database, {
    classes,
    teacherId: input.teacherId,
    now: input.now,
  });
  const attendance = attendanceEvidence.students;
  const calls = attendanceEvidence.classes.reduce(
    (sum, row) => ({ due: sum.due + row.due, confirmed: sum.confirmed + row.confirmed }),
    { due: 0, confirmed: 0 },
  );
  const occurrences = students.size
    ? await database.pedagogicalOccurrence.findMany({
        where: {
          deletedAt: null,
          studentId: { in: [...students.keys()] },
          OR: [
            {
              classSession: {
                deletedAt: null,
                classId: { in: classes.map((row) => row.id) },
                date: { gte: from, lte: today },
              },
            },
            { classSessionId: null, occurredOn: { gte: from, lte: today } },
          ],
        },
        select: {
          id: true,
          studentId: true,
          title: true,
          account: true,
          initialResponse: true,
          category: true,
          recordedBy: { select: { name: true } },
          status: true,
          occurredOn: true,
          classSession: { select: { date: true } },
          interventions: {
            where: {
              deletedAt: null,
              intervention: { deletedAt: null, performedOn: { lte: today } },
            },
            select: { intervention: { select: { studentId: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const gradeCandidates = new Map<string, GradeEvidence[]>();
  const books = new Map<string, { id: string; name: string; students: Set<string> }>();
  for (const group of classes) {
    const periods = teacherResponsibilityPeriods(group, input.teacherId);
    for (const enrollment of group.enrollments)
      for (const progress of enrollment.progressRecords) {
        const start = Math.max(
          group.semester.startDate.getTime(),
          enrollment.entryDate.getTime(),
          progress.startDate.getTime(),
        );
        const end = Math.min(
          today.getTime(),
          group.semester.endDate.getTime(),
          progress.endDate?.getTime() ?? Infinity,
        );
        if (
          start > end ||
          !periods.some(
            (period) =>
              period.start.getTime() <= end && (!period.end || period.end.getTime() > start),
          )
        )
          continue;
        const book = books.get(progress.stage.id) ?? {
          ...progress.stage,
          students: new Set<string>(),
        };
        book.students.add(enrollment.studentId);
        books.set(book.id, book);
        if (!progress.assessment || progress.assessment.deletedAt) continue;
        for (const grade of progress.assessment.grades) {
          if (
            grade.assessedOn < group.semester.startDate ||
            grade.assessedOn < enrollment.entryDate ||
            (enrollment.exitDate && grade.assessedOn >= enrollment.exitDate) ||
            grade.assessedOn < progress.startDate ||
            (progress.endDate && grade.assessedOn > progress.endDate) ||
            !periods.some((period) => inWindow(grade.assessedOn, period))
          )
            continue;
          const candidates = gradeCandidates.get(grade.id) ?? [];
          if (!candidates.some((row) => row.classId === group.id))
            candidates.push({
              id: grade.id,
              studentId: enrollment.studentId,
              classId: group.id,
              bookId: book.id,
              score: Number(grade.score),
              phase: grade.phase,
              competence: grade.competence,
            });
          gradeCandidates.set(grade.id, candidates);
        }
      }
  }
  // An assessment linked to overlapping classes is not evidence of either teacher's work.
  const grades = [...gradeCandidates.values()].flatMap((rows) => (rows.length === 1 ? rows : []));
  const studentRows = [...students].map(([id, name]) => {
    const result = byStudent.get(id);
    const ownAttendance = attendance.filter((row) => row.studentId === id);
    return {
      id,
      name,
      score: result?.score ?? null,
      level: result?.level ?? "INSUFFICIENT_DATA",
      healthGradeCount: result?.gradeCount ?? 0,
      healthHeldSessions: result?.heldSessions ?? 0,
      availableIndicators: result?.availableIndicators ?? 0,
      grades: studentMean(grades.filter((row) => row.studentId === id)),
      gradeCount: grades.filter((row) => row.studentId === id).length,
      attendance: absenceSummary(ownAttendance),
      occurrences: occurrences.filter((row) => row.studentId === id).length,
      pending: occurrences.filter((row) => row.studentId === id && row.status !== "CLOSED").length,
    };
  });
  return {
    from: from.toISOString().slice(0, 10),
    through: saoPauloDateOnly(input.now),
    semesters: [...new Set(classes.map((row) => row.semester.name))],
    score: mean(studentRows.map((row) => row.score)),
    coveredStudents: studentRows.filter((row) => row.score !== null).length,
    studentCount: studentRows.length,
    assessedStudents: new Set(grades.map((row) => row.studentId)).size,
    gradeCount: grades.length,
    ambiguousGrades: [...gradeCandidates.values()].filter((rows) => rows.length > 1).length,
    grades: studentMean(grades),
    attendance: absenceSummary(attendance),
    calls,
    students: studentRows,
    books: [...books.values()].map((book) => {
      const rows = grades.filter((row) => row.bookId === book.id);
      return {
        id: book.id,
        name: book.name,
        average: studentMean(rows),
        gradeCount: rows.length,
        studentCount: book.students.size,
        assessedStudents: new Set(rows.map((row) => row.studentId)).size,
        phases: ["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"].map((phase) => ({
          phase,
          average: studentMean(rows.filter((row) => row.phase === phase)),
        })),
      };
    }),
    classes: classes.map((group) => {
      const ids = new Set(group.enrollments.map((row) => row.studentId));
      const rows = studentRows.filter((row) => ids.has(row.id));
      return {
        id: group.id,
        name: group.portalClassName,
        scheduleType: group.scheduleType,
        stages: group.sharedStage
          ? [group.sharedStage.name]
          : [
              ...new Set(
                group.enrollments.flatMap((enrollment) =>
                  enrollment.progressRecords
                    .filter((progress) => progress.endDate === null || progress.endDate > today)
                    .map((progress) => progress.stage.name),
                ),
              ),
            ].sort(),
        schedule: group.scheduleSlots,
        studentCount: rows.length,
        studentIds: [...ids],
        score: mean(rows.map((row) => row.score)),
        grades: studentMean(grades.filter((row) => row.classId === group.id)),
        attendance: absenceSummary(attendance.filter((row) => row.classId === group.id)),
        calls: attendanceEvidence.classes.find((row) => row.classId === group.id) ?? {
          due: 0,
          confirmed: 0,
        },
      };
    }),
    occurrences: occurrences.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      name: students.get(row.studentId) ?? "Aluno",
      title: row.title,
      summary: row.account.length > 600 ? `${row.account.slice(0, 600)}…` : row.account,
      initialResponse:
        row.initialResponse && row.initialResponse.length > 300
          ? `${row.initialResponse.slice(0, 300)}…`
          : row.initialResponse,
      category: row.category,
      recordedBy: row.recordedBy.name,
      outsideClass: row.classSession === null,
      status: row.status,
      date: (row.classSession?.date ?? row.occurredOn)?.toISOString().slice(0, 10) ?? null,
      accompanied: row.interventions.some((link) => link.intervention.studentId === row.studentId),
    })),
  };
}
type GradeEvidence = {
  id: string;
  studentId: string;
  classId: string;
  bookId: string;
  score: number;
  phase: string;
  competence: string;
};
