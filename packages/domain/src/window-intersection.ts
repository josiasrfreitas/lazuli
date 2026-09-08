export type EnrollmentDateWindow = {
  entryDate: Date;
  exitDate: Date | null;
};

export type SemesterDateWindow = {
  startDate: Date;
  endDate: Date;
};

/** The inclusive overlap in which an enrollment belongs to a semester. */
export function intersectEnrollmentSemesterWindows(input: {
  enrollment: EnrollmentDateWindow;
  semester: SemesterDateWindow;
}): { startDate: Date; endDate: Date } | null {
  const startDate = new Date(
    Math.max(input.enrollment.entryDate.getTime(), input.semester.startDate.getTime()),
  );
  const enrollmentEndDate = input.enrollment.exitDate ?? input.semester.endDate;
  const endDate = new Date(Math.min(enrollmentEndDate.getTime(), input.semester.endDate.getTime()));

  return startDate > endDate ? null : { startDate, endDate };
}
