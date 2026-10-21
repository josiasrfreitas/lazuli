type DatedAppointment = { id: string; date: string; startTime: string; status: string };
export function sortStudentAppointments<T extends DatedAppointment>(rows: readonly T[]): T[] {
  return [...rows].toSorted((left, right) => {
    const scheduled = Number(right.status === "SCHEDULED") - Number(left.status === "SCHEDULED");
    if (scheduled) return scheduled;
    const chronological =
      left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime);
    return (
      (left.status === "SCHEDULED" ? chronological : -chronological) ||
      left.id.localeCompare(right.id)
    );
  });
}
