import { sessionEndInstant } from "./session-time.js";

/** Calendar changes only cancel activities that have not started and carry no recorded evidence. */
export function academicActivityCanBeCancelled(input: {
  date: Date | string;
  startTime: Date | string;
  status: string;
  recorded: boolean;
  now: Date;
}): boolean {
  return (
    input.status === "SCHEDULED" &&
    !input.recorded &&
    sessionEndInstant({ date: input.date, endTime: input.startTime }) > input.now
  );
}
