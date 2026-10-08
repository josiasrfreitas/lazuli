import type { Meeting } from "./meeting-dialog";
export type MeetingGroup = { start: string; end: string; meetings: Meeting[] };
export function hourSegments(meeting: Meeting): Array<{ start: string; end: string }> {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const time = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const end = minutes(meeting.endTime);
  const segments = [];
  for (let start = minutes(meeting.startTime); start < end; start += 60)
    segments.push({ start: time(start), end: time(Math.min(start + 60, end)) });
  return segments;
}
export function dayGroups(meetings: Meeting[]): MeetingGroup[] {
  const groups: MeetingGroup[] = [];
  for (const meeting of [...meetings].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  )) {
    const last = groups.at(-1);
    if (last && meeting.startTime < last.end) {
      last.meetings.push(meeting);
      if (meeting.endTime > last.end) last.end = meeting.endTime;
    } else groups.push({ start: meeting.startTime, end: meeting.endTime, meetings: [meeting] });
  }
  return groups;
}
