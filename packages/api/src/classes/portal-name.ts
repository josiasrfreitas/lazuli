import type { Prisma } from "@lazuli/db";
import { generateRegularPortalClassName, type PortalClassNameSlot } from "@lazuli/domain";

import { PORTAL_NAME_COLLISION_MESSAGE, badRequest } from "./errors.js";

const MAX_PORTAL_NAME_ATTEMPTS = 50;

type PortalNameDatabase = Pick<Prisma.TransactionClient, "class">;

export async function resolveRegularPortalClassName(input: {
  database: PortalNameDatabase;
  stageInternalCode: string;
  slots: readonly PortalClassNameSlot[];
  semesterName: string;
  year: number;
}): Promise<string> {
  for (let sequence = 1; sequence <= MAX_PORTAL_NAME_ATTEMPTS; sequence += 1) {
    const candidate = generateRegularPortalClassName({
      stageInternalCode: input.stageInternalCode,
      slots: input.slots,
      semesterName: input.semesterName,
      year: input.year,
      sequence,
    });

    const existing = await input.database.class.findFirst({
      where: {
        portalClassName: candidate,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing === null) {
      return candidate;
    }
  }

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
