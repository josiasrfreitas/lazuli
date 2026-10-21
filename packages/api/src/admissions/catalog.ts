import type { Prisma } from "@lazuli/db";
import { badRequest } from "../trpc/errors.js";

export async function admissionStages(database: Prisma.TransactionClient) {
  const stages = await database.stage.findMany({
    where: { deletedAt: null, track: { deletedAt: null, status: "ACTIVE" } },
    include: { track: { select: { name: true } } },
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
  });
  const tracks = new Set<string>();
  return stages.map((stage) => {
    const initial = !tracks.has(stage.trackId);
    tracks.add(stage.trackId);
    return { id: stage.id, name: stage.name, track: stage.track.name, initial };
  });
}

export async function assertInitialStage(
  database: Prisma.TransactionClient,
  stageId: string | null,
): Promise<void> {
  const stages = await admissionStages(database);
  if (!stages.some((stage) => stage.id === stageId && stage.initial))
    throw badRequest("Escolha o primeiro estágio de uma track para quem está começando.");
}
