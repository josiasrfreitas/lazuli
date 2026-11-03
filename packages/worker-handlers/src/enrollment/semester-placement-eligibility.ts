import { effectiveTeacherId, type SemesterEligibility } from "@lazuli/domain";
import { dateOnly, type Placement } from "./semester-placement-data.js";

export function eligibility(row: Placement): SemesterEligibility {
  const entryOn = dateOnly(row.entryAction!.effectiveDate);
  return {
    entryOn,
    semesterId: row.semesterId,
    studentActive: row.student.status === "ACTIVE" && !row.student.deletedAt,
    mode: row.mode,
    stage:
      row.stage && !row.stage.deletedAt && row.stage.track.status === "ACTIVE"
        ? { id: row.stage.id, trackId: row.stage.trackId, sequence: row.stage.sequence }
        : null,
    source: sourceEligibility(row),
    plan: planEligibility(row, entryOn),
  };
}

function sourceEligibility(row: Placement): SemesterEligibility["source"] {
  const source = row.sourceProgress;
  const enrollment = row.sourceEnrollment;
  if (!source || !enrollment) return null;
  return {
    semesterId: enrollment.class.semesterId,
    active: !source.deletedAt && !source.endDate && !enrollment.deletedAt && !enrollment.exitDate,
    stageId: source.stageId,
    trackId: source.stage.trackId,
    sequence: source.stage.sequence,
    scheduleType: enrollment.class.scheduleType,
    decision: source.assessment?.decision ?? null,
    confirmed: Boolean(source.assessment?.confirmedAt && !source.assessment.deletedAt),
  };
}
function planEligibility(row: Placement, entryOn: string): SemesterEligibility["plan"] {
  const target = row.enrollment?.class;
  if (!target) return null;
  return {
    scheduleType: target.scheduleType,
    sharedStageId: target.sharedStageId,
    teacherReady: planTeacherReady(target, entryOn),
    active: target.status === "ACTIVE" && !target.deletedAt && !row.enrollment?.deletedAt,
  };
}
function planTeacherReady(
  target: NonNullable<Placement["enrollment"]>["class"],
  entryOn: string,
): boolean {
  const teachers = [target.teacher, ...target.teacherAssignments.map((item) => item.teacher)];
  const teacherId = effectiveTeacherId({
    initialTeacherId: target.teacherId,
    assignments: target.teacherAssignments.map((item) => ({
      teacherId: item.teacherId,
      effectiveDate: dateOnly(item.effectiveDate),
    })),
    departureDates: new Map(
      teachers.map((teacher) => [
        teacher.id,
        teacher.teacherProfile?.departureDate
          ? dateOnly(teacher.teacherProfile.departureDate)
          : null,
      ]),
    ),
    date: entryOn,
  });
  return Boolean(
    teacherId && teachers.some((teacher) => teacher.id === teacherId && !teacher.deletedAt),
  );
}
