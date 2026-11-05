import type { Prisma } from "@lazuli/db";
import {
  generateRegularPortalClassName,
  generatePersonalizedPortalClassName,
  type PortalClassNameSlot,
} from "@lazuli/domain";

import { badRequest } from "../trpc/errors.js";
import { PORTAL_NAME_COLLISION_MESSAGE } from "./errors.js";

const MAX_PORTAL_NAME_ATTEMPTS = 50;

type PortalNameDatabase = Pick<Prisma.TransactionClient, "class">;

export async function resolveRegularPortalClassName(input: {
  database: PortalNameDatabase;
  stageInternalCode: string;
  slots: readonly PortalClassNameSlot[];
  semesterName: string;
  year: number;
}): Promise<string> {
  return resolveGeneratedPortalClassName(input.database, (sequence) =>
    generateRegularPortalClassName({ ...input, sequence }),
  );
}

export async function resolvePersonalizedPortalClassName(input: {
  database: PortalNameDatabase;
  slots: readonly PortalClassNameSlot[];
  semesterName: string;
  year: number;
}): Promise<string> {
  return resolveGeneratedPortalClassName(input.database, (sequence) =>
    generatePersonalizedPortalClassName({ ...input, sequence }),
  );
}

async function resolveGeneratedPortalClassName(
  database: PortalNameDatabase,
  generate: (sequence: number) => string,
): Promise<string> {
  const candidates = Array.from({ length: MAX_PORTAL_NAME_ATTEMPTS }, (_unused, index) =>
    generate(index + 1),
  );
  const existing = await database.class.findMany({
    where: {
      portalClassName: { in: candidates },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { portalClassName: true },
  });
  const occupied = new Set(existing.map((row) => row.portalClassName));
  const available = candidates.find((candidate) => !occupied.has(candidate));
  if (available !== undefined) return available;

  throw badRequest(PORTAL_NAME_COLLISION_MESSAGE);
}

export async function assertActivePortalClassNameAvailable(input: {
  database: PortalNameDatabase;
  portalClassName: string;
}): Promise<void> {
  const existing = await input.database.class.findFirst({
    where: {
      portalClassName: input.portalClassName,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing !== null) {
    throw badRequest(PORTAL_NAME_COLLISION_MESSAGE);
  }
}
