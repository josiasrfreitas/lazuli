import type { Prisma } from "@lazuli/db";
import type { ArtifactKind, GetArtifactOutput } from "@lazuli/validators";
import { deriveArtifactStatus } from "@lazuli/validators";

import { assertResourceScope } from "../trpc/rbac.js";
import type { StaffUser } from "../trpc/context.js";
import { reportForbidden, reportNotFound } from "./errors.js";

type ArtifactRow = {
  id: string;
  kind: ArtifactKind;
  requestedById: string | null;
  studentId: string | null;
  classId: string | null;
  orderId: string | null;
  storageBucket: string | null;
  storageObject: string | null;
  contentType: string | null;
  fileName: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: Date | null;
};

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

function toArtifactOutput(row: ArtifactRow): GetArtifactOutput {
  return {
    id: row.id,
    kind: row.kind,
    status: deriveArtifactStatus({
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
    }),
    requestedById: row.requestedById,
    studentId: row.studentId,
    classId: row.classId,
    orderId: row.orderId,
    storageBucket: row.storageBucket,
    storageObject: row.storageObject,
    contentType: row.contentType,
    fileName: row.fileName,
    requestedAt: row.requestedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    expiresAt: row.expiresAt,
  };
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
