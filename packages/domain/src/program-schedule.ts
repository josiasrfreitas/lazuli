/** Distribute canonical activities without compressing their teaching time. */
export function scheduleProgram<T extends { id: string; durationMinutes: number }>(
  activities: readonly T[],
  sessions: readonly { id?: string; date: string; minutes: number }[],
): { scheduled: { activity: T; date: string; sessionId?: string }[]; missingMinutes: number } {
  const scheduled: { activity: T; date: string; sessionId?: string }[] = [];
  let sessionIndex = 0;
  let remaining = sessions[0]?.minutes ?? 0;
  let missingMinutes = 0;
  for (const activity of activities) {
    let duration = activity.durationMinutes;
    while (duration > 0 && sessionIndex < sessions.length) {
      const consumed = Math.min(duration, remaining);
      duration -= consumed;
      remaining -= consumed;
      if (duration === 0) {
        const session = sessions[sessionIndex]!;
        scheduled.push({
          activity,
          date: session.date,
          ...(session.id ? { sessionId: session.id } : {}),
        });
      }
      if (remaining === 0) {
        sessionIndex++;
        remaining = sessions[sessionIndex]?.minutes ?? 0;
      }
    }
    missingMinutes += duration;
  }
  return { scheduled, missingMinutes };
}
