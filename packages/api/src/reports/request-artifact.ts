import type { Prisma } from "@lazuli/db";
import type { ArtifactKind } from "@lazuli/validators";
import {
  createLocalReportGenerateQueue,
  enqueueReportGenerate,
  type ReportGenerateQueue,
} from "@lazuli/job-contracts";

import type { StaffUser } from "../trpc/context.js";

type RequestArtifactDatabase = Pick<Prisma.TransactionClient, "generatedArtifact" | "student" | "class">;

export async function requestReportArtifact(input: {
  database: RequestArtifactDatabase;
  reportGenerateQueue: ReportGenerateQueue;
  staffUser: StaffUser;
  kind: ArtifactKind;
  studentId?: string;
  classId?: string;
  now?: Date;
}): Promise<{ artifactId: string; jobId: string }> {
  if (input.studentId !== undefined) {
    await assertStudentExists({ database: input.database, studentId: input.studentId });
  }

  if (input.classId !== undefined) {
    await assertClassExists({ database: input.database, classId: input.classId });
  }

  const requestedAt = input.now ?? new Date();
  const artifact = await input.database.generatedArtifact.create({
    data: {
      kind: input.kind,
      requestedById: input.staffUser.id,
      requestedAt,
      ...optionalStudentId(input.studentId),
      ...optionalClassId(input.classId),
    },
  });

  const job = await enqueueReportGenerate({
    queue: input.reportGenerateQueue,
    payload: { artifactId: artifact.id },
  });

  return { artifactId: artifact.id, jobId: job.jobId };
}

async function assertStudentExists(input: {
  database: RequestArtifactDatabase;
  studentId: string;
}): Promise<void> {
  const student = await input.database.student.findFirst({
    where: { id: input.studentId, deletedAt: null },
    select: { id: true },
  });

  if (student === null) {
    const { reportNotFound } = await import("./errors.js");
    reportNotFound("student");
  }
}

async function assertClassExists(input: {
  database: RequestArtifactDatabase;
  classId: string;
}): Promise<void> {
  const classRow = await input.database.class.findFirst({
    where: { id: input.classId, deletedAt: null },
    select: { id: true, teacherId: true },
  });

  if (classRow === null) {
    const { reportNotFound } = await import("./errors.js");
    reportNotFound("class");
  }
}

export function resolveReportGenerateQueue(
  queue: ReportGenerateQueue | undefined,
): ReportGenerateQueue {
  return queue ?? createLocalReportGenerateQueue();
}

function optionalStudentId(studentId: string | undefined): { studentId?: string } {
  return studentId === undefined ? {} : { studentId };
}

function optionalClassId(classId: string | undefined): { classId?: string } {
  return classId === undefined ? {} : { classId };
}
