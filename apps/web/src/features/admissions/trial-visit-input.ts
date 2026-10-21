type Meeting = {
  id: string;
  date: string;
  classId: string;
  scheduleSlotId: string | null;
  classSessionId: string | null;
};
type TrialInput = {
  date: string;
  meeting: {
    kind: "TRIAL";
    classId: string;
    scheduleSlotId: string | null;
    classSessionId: string | null;
  };
};

export function trialVisitInput(
  meetings: readonly Meeting[],
  meetingId: string | null,
): TrialInput | null {
  const chosen = meetings.find((row) => row.id === meetingId);
  if (!chosen) return null;
  return {
    date: chosen.date,
    meeting: {
      kind: "TRIAL",
      classId: chosen.classId,
      scheduleSlotId: chosen.scheduleSlotId,
      classSessionId: chosen.classSessionId,
    },
  };
}
