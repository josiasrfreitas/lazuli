import type { ArtifactKind, GetArtifactOutput } from "@lazuli/validators";
import { deriveArtifactStatus } from "@lazuli/validators";

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

export function toArtifactOutput(row: ArtifactRow): GetArtifactOutput {
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
