import { readStudentHealth as readHealth } from "@lazuli/db";
import type { Context } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";

export async function readStudentHealth(input: {
  database: Context["db"];
  id: string;
  now: Date;
}): Promise<Awaited<ReturnType<typeof readHealth>>> {
  const student = await input.database.student.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  return readHealth(input);
}
