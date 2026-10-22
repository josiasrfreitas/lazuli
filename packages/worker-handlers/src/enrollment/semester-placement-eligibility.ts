import { effectiveTeacherId, type SemesterEligibility } from "@lazuli/domain";
import { classScheduleSlotInputSchema, z } from "@lazuli/validators";
import { dateOnly, type Placement, type Availability } from "./semester-placement-data.js";

const TIME_START = 11;
const TIME_END = 16;
function slots(
  value: Availability["slots"],
): NonNullable<SemesterEligibility["availability"]>["slots"] {
  return z.array(classScheduleSlotInputSchema).parse(value);
}

export function eligibility(
  row: Placement,
  availability: Availability | null,
): SemesterEligibility {
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
    availability: availability
      ? {
          confirmed: availability.confirmed,
          validUntil: dateOnly(availability.validUntil),
          formats: availability.formats,
          slots: slots(availability.slots),
        }
      : null,
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
    format: target.format,
    slots: target.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime.toISOString().slice(TIME_START, TIME_END),
      endTime: slot.endTime.toISOString().slice(TIME_START, TIME_END),
    })),
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
