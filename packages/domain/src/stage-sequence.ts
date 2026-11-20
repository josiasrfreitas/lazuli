export type StageInTrack = {
  id: string;
  internalCode: string;
  sequence: number;
  status?: "ACTIVE" | "LEGACY";
};

/** Returns the next stage in the same track, or null at end of path ("fim da trilha"). */
export function findNextStageInTrack(input: {
  stages: readonly StageInTrack[];
  currentStageId: string;
}): StageInTrack | null {
  const current = input.stages.find((stage) => stage.id === input.currentStageId);
  if (current === undefined) {
    return null;
  }

  const following = input.stages.filter(
    (stage) => stage.sequence > current.sequence && stage.status !== "LEGACY",
  );
  return following.toSorted((left, right) => left.sequence - right.sequence)[0] ?? null;
}
