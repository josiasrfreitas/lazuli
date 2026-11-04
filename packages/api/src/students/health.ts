import type { Context } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";

export async function readStudentHealth(input: {
  database: Context["db"];
  id: string;
  now: Date;
}): Promise<Awaited<ReturnType<(typeof import("@lazuli/db"))["readStudentHealth"]>>> {
  const student = await input.database.student.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const { readStudentHealth: readHealth } = await import("@lazuli/db");
  return readHealth(input);
}

export async function readStudentHealthBatch(input: {
  database: Context["db"];
  ids: string[];
  now: Date;
}): Promise<Awaited<ReturnType<(typeof import("@lazuli/db"))["readStudentHealthBatch"]>>> {
  const { readStudentHealthBatch: readHealth } = await import("@lazuli/db");
  return readHealth(input);
}
