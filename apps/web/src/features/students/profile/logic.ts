import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
export type StudentProfile = RouterOutputs["students"]["byId"];
export type StudentPedagogy = RouterOutputs["students"]["pedagogy"];
export type StudentEnrollment = StudentPedagogy["enrollments"][number];

export function useStudentProfile(id: string): QueryResult<StudentProfile> {
  return trpc.students.byId.useQuery({ id }, { retry: false });
}
export function useStudentPedagogy(id: string): QueryResult<StudentPedagogy> {
  return trpc.students.pedagogy.useQuery({ id }, { retry: false });
}
