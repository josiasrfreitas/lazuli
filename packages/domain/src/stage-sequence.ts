export type StageInTrack = {
  id: string;
  internalCode: string;
  sequence: number;
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

  const nextSequence = current.sequence + 1;
  return input.stages.find((stage) => stage.sequence === nextSequence) ?? null;
}
