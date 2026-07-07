import type { Prisma } from "@lazuli/db";
import type { ArtifactKind, GetArtifactOutput } from "@lazuli/validators";

import { assertResourceScope } from "../trpc/rbac.js";
import type { StaffUser } from "../trpc/context.js";
import { toArtifactOutput } from "./artifact-output.js";
import { reportForbidden, reportNotFound } from "./errors.js";

type GetArtifactDatabase = Pick<Prisma.TransactionClient, "generatedArtifact" | "class">;

export async function getArtifact(input: {
  database: GetArtifactDatabase;
  staffUser: StaffUser;
  id: string;
}): Promise<GetArtifactOutput> {
  const artifact = await input.database.generatedArtifact.findFirst({
    where: { id: input.id, deletedAt: null },
  });

  if (artifact === null) {
    reportNotFound("artifact");
  }

  await assertArtifactAccess({
    database: input.database,
    staffUser: input.staffUser,
    artifact,
  });

  return toArtifactOutput(artifact);
}

async function assertArtifactAccess(input: {
  database: GetArtifactDatabase;
  staffUser: StaffUser;
  artifact: {
    kind: ArtifactKind;
    classId: string | null;
  };
}): Promise<void> {
  if (input.staffUser.role === "ADMIN") {
    return;
  }

  if (input.artifact.kind !== "CLASS_ROSTER_PDF" || input.artifact.classId === null) {
    reportForbidden();
  }

  const classRow = await input.database.class.findFirst({
    where: { id: input.artifact.classId, deletedAt: null },
    select: { teacherId: true },
  });

  if (classRow === null) {
    reportNotFound("class");
  }

  assertResourceScope(input.staffUser, classRow);
}

export async function assertClassRosterScope(input: {
  database: Pick<Prisma.TransactionClient, "class">;
  staffUser: StaffUser;
  classId: string;
}): Promise<void> {
  const classRow = await input.database.class.findFirst({
    where: { id: input.classId, deletedAt: null },
    select: { teacherId: true },
  });

  if (classRow === null) {
    reportNotFound("class");
  }

  assertResourceScope(input.staffUser, classRow);
}
