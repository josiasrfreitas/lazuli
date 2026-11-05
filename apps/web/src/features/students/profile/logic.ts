import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { needsStudentPedagogy, needsStudentFinanceSummary } from "./query-policy";
export type StudentProfile = RouterOutputs["students"]["byId"];
export type StudentPedagogy = RouterOutputs["students"]["pedagogy"];
export type StudentEnrollment = StudentPedagogy["enrollments"][number];

export function useStudentProfile(id: string): QueryResult<StudentProfile> {
  return trpc.students.byId.useQuery({ id }, { retry: false, staleTime: 0 });
}
export function useStudentPedagogy(id: string, enabled = true): QueryResult<StudentPedagogy> {
  return trpc.students.pedagogy.useQuery({ id }, { enabled, retry: false, staleTime: 0 });
}

export function useStudentSectionData(
  id: string,
  section: string,
): {
  pedagogy: QueryResult<StudentPedagogy>;
  finance: QueryResult<RouterOutputs["finance"]["studentSummary"]>;
  hasPpt: boolean;
} {
  const pedagogy = useStudentPedagogy(id, needsStudentPedagogy(section));
  const hasPpt = Boolean(
    pedagogy.data?.enrollments.some((row) => row.class.scheduleType === "PERSONALIZED"),
  );
  const finance = trpc.finance.studentSummary.useQuery(
    { studentId: id },
    {
      enabled: needsStudentFinanceSummary(section, {
        ready: Boolean(pedagogy.data),
        hasPersonalizedEnrollment: hasPpt,
      }),
    },
  );
  return { pedagogy, finance, hasPpt };
}
