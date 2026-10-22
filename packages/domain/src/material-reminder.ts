const CIVIL_DAY_MILLISECONDS = 86_400_000;
const MATERIAL_REMINDER_DAYS = 30;

/** Only the final thirty civil days of an academic plan call for attention. */
export function materialReminderState(date: string | null, asOf: string): "soon" | "due" | null {
  if (!date) return null;
  const days =
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / CIVIL_DAY_MILLISECONDS;
  if (days <= 0) return "due";
  return days <= MATERIAL_REMINDER_DAYS ? "soon" : null;
}

/** A material sale is coverage even while its receipt is pending. It is not purchased twice. */
export function stageMaterialAttention(input: {
  asOf: string;
  plannedEndOn: string | null;
  currentStageId: string;
  nextStageId: string | null;
  acquiredStageIds: readonly string[];
}): { timing: "soon" | "due"; stagePending: boolean } | null {
  const timing = materialReminderState(input.plannedEndOn, input.asOf);
  if (!timing || input.nextStageId === input.currentStageId) return null;
  if (input.nextStageId && input.acquiredStageIds.includes(input.nextStageId)) return null;
  return { timing, stagePending: input.nextStageId === null };
}
