/** Availability is expressed in school-local wall time, inclusive at both boundaries. */
export type AvailabilityWindow = { weekday: string; startTime: string; endTime: string };
export function availabilityCovers(
  windows: readonly AvailabilityWindow[],
  meetings: readonly AvailabilityWindow[],
): boolean {
  return (
    meetings.length > 0 &&
    meetings.every((meeting) => {
      const matching = windows
        .filter((window) => window.weekday === meeting.weekday)
        .toSorted((left, right) => left.startTime.localeCompare(right.startTime));
      let coveredThrough = meeting.startTime;
      for (const window of matching) {
        if (window.startTime > coveredThrough) break;
        if (window.endTime > coveredThrough) coveredThrough = window.endTime;
        if (coveredThrough >= meeting.endTime) return true;
      }
      return false;
    })
  );
}
export function availabilityIsCurrent(availableUntil: string, date: string): boolean {
  return availableUntil >= date;
}
