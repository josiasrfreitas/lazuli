import { DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";

const studentIndices = new Map(DEV_STUDENTS.map((student, index) => [student.key, index]));

/** Resolve the existing fixture key without coupling a scenario to its array position. */
export function seedStudentIndex(key: string): number {
  const index = studentIndices.get(key);
  if (index === undefined) throw new Error(`Unknown student fixture: ${key}`);
  return index;
}
