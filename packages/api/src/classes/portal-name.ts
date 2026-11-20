import type { Prisma } from "@lazuli/db";
import { generatePortalClassName, type ClassNameInput } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { PORTAL_NAME_COLLISION_MESSAGE } from "./errors.js";

const MAX_PORTAL_NAME_ATTEMPTS = 50;
type NamingDatabase = Pick<Prisma.TransactionClient, "stage" | "user" | "class">;
type ClassNameFields = Pick<ClassNameInput, "scheduleType" | "slots"> & {
  sharedStageId?: string | null | undefined;
  teacherId: string | null;
};

async function namingDetails(
  database: NamingDatabase,
  fields: ClassNameFields,
): Promise<ClassNameInput> {
  const [stage, teacher] = await Promise.all([
    fields.scheduleType === "REGULAR" && fields.sharedStageId
      ? database.stage.findUnique({
          where: { id: fields.sharedStageId },
          select: { internalCode: true },
        })
      : null,
    fields.teacherId
      ? database.user.findUnique({ where: { id: fields.teacherId }, select: { name: true } })
      : null,
  ]);
  return {
    scheduleType: fields.scheduleType,
    slots: fields.slots,
    stageInternalCode: stage?.internalCode,
    teacherName: teacher?.name,
  };
}

export async function plannedClassName(
  database: NamingDatabase,
  fields: ClassNameFields,
): Promise<string> {
  return generatePortalClassName(await namingDetails(database, fields));
}

/** Published classes share a unique active name across periods. Drafts do not reserve it. */
export async function resolvePortalClassName(
  database: NamingDatabase,
  fields: ClassNameFields,
): Promise<string> {
  const details = await namingDetails(database, fields);
  const candidates = Array.from({ length: MAX_PORTAL_NAME_ATTEMPTS }, (_unused, index) =>
    generatePortalClassName(details, index + 1),
  );
  const existing = await database.class.findMany({
    where: { portalClassName: { in: candidates }, status: "ACTIVE", deletedAt: null },
    select: { portalClassName: true },
  });
  const occupied = new Set(existing.map((row) => row.portalClassName));
  const available = candidates.find((candidate) => !occupied.has(candidate));
  if (available === undefined) throw badRequest(PORTAL_NAME_COLLISION_MESSAGE);
  return available;
}
