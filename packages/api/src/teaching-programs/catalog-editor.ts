import { randomUUID } from "node:crypto";
import type { DatabaseClient, Prisma } from "@lazuli/db";
import { z } from "@lazuli/validators";
import { lockProgramStage } from "./import.js";
import { badRequest, notFound } from "../trpc/errors.js";

const MAX_TITLE_LENGTH = 180;
const MAX_CODE_LENGTH = 40;
export const id = z.string().uuid();
export const title = z.string().trim().min(1, "Informe um nome.").max(MAX_TITLE_LENGTH);
const code = z.string().trim().min(1, "Informe o código.").max(MAX_CODE_LENGTH);
const target = z.enum(["track", "stage"]);
export const catalogCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createTrack"),
    productLineId: id,
    name: title,
    ageGroup: z.enum(["ADULT", "CHILD"]),
  }),
  z.object({ action: z.literal("createStage"), trackId: id, name: title, internalCode: code }),
  z.object({ action: z.literal("editStage"), id, name: title, internalCode: code }),
  z.object({ action: z.literal("legacy"), target, id }),
  z.object({
    action: z.literal("move"),
    target,
    id,
    neighborId: id,
    direction: z.enum(["up", "down"]),
    showLegacy: z.boolean(),
  }),
  z.object({ action: z.literal("lesson"), stageId: id, lessonId: id.optional(), title }),
]);

type Command = z.infer<typeof catalogCommand>;
type Tx = Prisma.TransactionClient;
const activeTrack = { deletedAt: null, productLine: { deletedAt: null } };
const directoryQuery = {
  where: activeTrack,
  orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  select: {
    id: true,
    name: true,
    ageGroup: true,
    status: true,
    productLine: { select: { id: true, name: true } },
    stages: {
      where: { deletedAt: null },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        name: true,
        internalCode: true,
        status: true,
        bookLessonCount: true,
        sequence: true,
      },
    },
  },
} satisfies Prisma.TrackFindManyArgs;
type Directory = {
  tracks: Prisma.TrackGetPayload<typeof directoryQuery>[];
  productLines: { id: string; name: string }[];
};
export async function catalogDirectory(db: Tx): Promise<Directory> {
  const [tracks, productLines] = await Promise.all([
    db.track.findMany(directoryQuery),
    db.productLine.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { tracks, productLines };
}
export function editCatalog(db: DatabaseClient, input: Command): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('stage-catalog-order', 0)) IS NULL AS locked`;
    switch (input.action) {
      case "createTrack": {
        return createTrack(tx, input);
      }
      case "createStage":
      case "editStage": {
        return saveStage(tx, input);
      }
      case "move": {
        return move(tx, input);
      }
      case "legacy": {
        const where = { id: input.id, deletedAt: null };
        const data = { status: "LEGACY" as const };
        return input.target === "track"
          ? tx.track.update({ where, data, select: { id: true } })
          : tx.stage.update({ where, data, select: { id: true } });
      }
      case "lesson": {
        return saveLesson(tx, input);
      }
    }
  });
}
async function move(tx: Tx, input: Extract<Command, { action: "move" }>): Promise<{ id: string }> {
  const visibility = input.showLegacy ? {} : { status: "ACTIVE" as const };
  const delta = input.direction === "up" ? -1 : 1;
  if (input.target === "track") {
    const rows = await tx.track.findMany({
      where: { ...activeTrack, ...visibility },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, displayOrder: true },
    });
    const [item, next] = neighbors(rows, { id: input.id, neighbor: input.neighborId, delta });
    await tx.track.update({ where: { id: item.id }, data: { displayOrder: next.displayOrder } });
    await tx.track.update({ where: { id: next.id }, data: { displayOrder: item.displayOrder } });
  } else {
    const stage = await tx.stage.findFirstOrThrow({ where: { id: input.id, track: activeTrack } });
    const rows = await tx.stage.findMany({
      where: { trackId: stage.trackId, ...visibility },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true },
    });
    const [item, next] = neighbors(rows, { id: input.id, neighbor: input.neighborId, delta });
    const last = await tx.stage.aggregate({
      where: { trackId: stage.trackId, deletedAt: {} },
      _max: { sequence: true },
    });
    await tx.stage.update({
      where: { id: item.id },
      data: { sequence: (last._max.sequence ?? 0) + 1 },
    });
    await tx.stage.update({ where: { id: next.id }, data: { sequence: item.sequence } });
    await tx.stage.update({ where: { id: item.id }, data: { sequence: next.sequence } });
  }
  return { id: input.id };
}
function neighbors<T extends { id: string }>(
  rows: T[],
  { id, neighbor, delta }: { id: string; neighbor: string; delta: number },
): [T, T] {
  const index = rows.findIndex((row) => row.id === id);
  const item = rows.find((row) => row.id === id),
    next = rows[index + delta];
  if (!item) throw notFound("Item indisponível no catálogo.");
  if (!next || next.id !== neighbor)
    throw badRequest("A ordem mudou. Atualize o catálogo e tente novamente.");
  return [item, next];
}

async function createTrack(
  tx: Tx,
  input: Extract<Command, { action: "createTrack" }>,
): Promise<{ id: string }> {
  await tx.productLine.findFirstOrThrow({
    where: { id: input.productLineId, status: "ACTIVE" },
  });
  if (
    await tx.track.findUnique({
      where: {
        productLineId_name: { productLineId: input.productLineId, name: input.name },
        deletedAt: {},
      },
    })
  )
    throw badRequest("Já existe uma track com este nome nesta linha.");
  return tx.track.create({
    data: { productLineId: input.productLineId, name: input.name, ageGroup: input.ageGroup },
    select: { id: true },
  });
}

async function saveStage(
  tx: Tx,
  input: Extract<Command, { action: "createStage" | "editStage" }>,
): Promise<{ id: string }> {
  const previous =
    input.action === "editStage"
      ? await tx.stage.findFirstOrThrow({ where: { id: input.id, track: activeTrack } })
      : null;
  const trackId = input.action === "createStage" ? input.trackId : previous!.trackId;
  const duplicate = await tx.stage.findFirst({
    where: { trackId, internalCode: input.internalCode, deletedAt: {} },
  });
  if (duplicate && (input.action === "createStage" || duplicate.id !== input.id))
    throw badRequest("Este código já está em uso nesta track.");
  const data = { name: input.name, internalCode: input.internalCode };
  if (input.action === "editStage")
    return tx.stage.update({ where: { id: input.id }, data, select: { id: true } });
  await tx.track.findFirstOrThrow({
    where: { id: trackId, ...activeTrack, status: "ACTIVE" },
  });
  const last = await tx.stage.aggregate({
    where: { trackId, deletedAt: {} },
    _max: { sequence: true },
  });
  return tx.stage.create({
    data: { ...data, trackId, sequence: (last._max.sequence ?? 0) + 1 },
    select: { id: true },
  });
}

async function saveLesson(
  tx: Tx,
  input: Extract<Command, { action: "lesson" }>,
): Promise<{ id: string }> {
  await lockProgramStage(tx, input.stageId);
  await tx.stage.findFirstOrThrow({ where: { id: input.stageId, track: activeTrack } });
  if (input.lessonId)
    return tx.bookLesson.update({
      where: { id: input.lessonId, stageId: input.stageId, deletedAt: null },
      data: { title: input.title },
      select: { id: true },
    });
  const last = await tx.bookLesson.aggregate({
    where: { stageId: input.stageId, deletedAt: {} },
    _max: { sequence: true },
  });
  const lesson = await tx.bookLesson.create({
    data: {
      stageId: input.stageId,
      sequence: (last._max.sequence ?? 0) + 1,
      title: input.title,
      sourceKey: randomUUID(),
    },
    select: { id: true },
  });
  const count = await tx.bookLesson.count({ where: { stageId: input.stageId } });
  await tx.stage.update({ where: { id: input.stageId }, data: { bookLessonCount: count } });
  return lesson;
}
