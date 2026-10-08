import type { KyselyDatabase, TransactionClient } from "@lazuli/db";
import type { studentSearchInputSchema, z } from "@lazuli/validators";
import { sql, type SelectQueryBuilder } from "kysely";

export type StudentSearchResult = {
  fullName: string;
  id: string;
  phone: string | null;
  status: string;
};
type SearchDatabase = KyselyDatabase & { student: KyselyDatabase["Student"] };
type Database = Pick<TransactionClient, "$kysely">;
const SEARCH_LIMIT = 10;

/** Keep eligibility predicates on the query so filtering happens before ranking and limiting. */
export function studentSearchQuery(
  database: Database,
  query: string,
): SelectQueryBuilder<SearchDatabase, "student", StudentSearchResult> {
  const contains = `%${query}%`;
  const prefix = `${query}%`;
  const wordPrefix = `% ${query}%`;
  return database.$kysely
    .selectFrom("Student as student")
    .select(["student.id", "student.full_name as fullName", "student.phone", "student.status"])
    .where("student.deleted_at", "is", null)
    .where(
      sql<boolean>`
        (
              student.full_name ILIKE ${contains}
              OR student.document_number ILIKE ${contains}
              OR student.phone ILIKE ${contains}
              OR student.email ILIKE ${contains}
              OR similarity(student.full_name, ${query}::text) > 0.1
              OR similarity(COALESCE(student.document_number, ''), ${query}::text) > 0.1
              OR similarity(COALESCE(student.phone, ''), ${query}::text) > 0.1
              OR similarity(COALESCE(student.email, ''), ${query}::text) > 0.1
            )
      `,
    )
    .orderBy(
      sql<number>`
        CASE
              WHEN student.full_name ILIKE ${prefix} OR student.full_name ILIKE ${wordPrefix} THEN 500
              WHEN student.full_name ILIKE ${contains} THEN 400
              WHEN student.document_number ILIKE ${contains} THEN 300
              WHEN student.phone ILIKE ${contains} THEN 200
              WHEN student.email ILIKE ${contains} THEN 100
              ELSE GREATEST(
                similarity(student.full_name, ${query}::text),
                similarity(COALESCE(student.document_number, ''), ${query}::text),
                similarity(COALESCE(student.phone, ''), ${query}::text),
                similarity(COALESCE(student.email, ''), ${query}::text)
              ) END
      `,
      "desc",
    )
    .orderBy("student.full_name", "asc")
    .orderBy("student.id", "asc")
    .limit(SEARCH_LIMIT);
}

export async function searchStudents(input: {
  database: Database;
  values: z.infer<typeof studentSearchInputSchema>;
}): Promise<StudentSearchResult[]> {
  return studentSearchQuery(input.database, input.values.query).execute();
}
