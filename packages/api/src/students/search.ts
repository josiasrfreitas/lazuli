import { normalizeSearch } from "@lazuli/domain";
import { normalizedKysely, searchMatchKysely } from "../search.js";
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
const STUDENT_FULL_NAME = "student.full_name";
const STUDENT_DOCUMENT_NUMBER = "student.document_number";
const STUDENT_PHONE = "student.phone";
const STUDENT_EMAIL = "student.email";

/** Keep eligibility predicates on the query so filtering happens before ranking and limiting. */
export function studentSearchQuery(
  database: Database,
  query: string,
): SelectQueryBuilder<SearchDatabase, "student", StudentSearchResult> {
  const originalQuery = query;
  query = normalizeSearch(query);
  const contains = `%${query}%`;
  const prefix = `${query}%`;
  const wordPrefix = `(^|[^[:alnum:]])${query}`;
  return database.$kysely
    .selectFrom("Student as student")
    .select(["student.id", "student.full_name as fullName", "student.phone", "student.status"])
    .where("student.deleted_at", "is", null)
    .where(
      sql<boolean>`
        (
              ${searchMatchKysely(sql.ref(STUDENT_FULL_NAME), originalQuery)}
              OR ${normalizedKysely(sql.ref(STUDENT_DOCUMENT_NUMBER))} LIKE ${contains}
              OR ${normalizedKysely(sql.ref(STUDENT_PHONE))} LIKE ${contains}
              OR ${normalizedKysely(sql.ref(STUDENT_EMAIL))} LIKE ${contains}
            )
      `,
    )
    .orderBy(
      sql<number>`
        CASE
              WHEN ${normalizedKysely(sql.ref(STUDENT_FULL_NAME))} ILIKE ${prefix}
                OR lower(regexp_replace(normalize(student.full_name, NFD), '[̀-ͯ]', '', 'g')) ~ ${wordPrefix} THEN 500
              WHEN ${normalizedKysely(sql.ref(STUDENT_FULL_NAME))} ILIKE ${contains} THEN 400
              WHEN ${normalizedKysely(sql.ref(STUDENT_DOCUMENT_NUMBER))} ILIKE ${contains} THEN 300
              WHEN ${normalizedKysely(sql.ref(STUDENT_PHONE))} ILIKE ${contains} THEN 200
              WHEN ${normalizedKysely(sql.ref(STUDENT_EMAIL))} ILIKE ${contains} THEN 100
              ELSE GREATEST(
                similarity(${normalizedKysely(sql.ref(STUDENT_FULL_NAME))}, ${query}::text),
                similarity(${normalizedKysely(sql.ref(STUDENT_DOCUMENT_NUMBER))}, ${query}::text),
                similarity(${normalizedKysely(sql.ref(STUDENT_PHONE))}, ${query}::text),
                similarity(${normalizedKysely(sql.ref(STUDENT_EMAIL))}, ${query}::text)
              ) END
      `,
      "desc",
    )
    .orderBy(STUDENT_FULL_NAME, "asc")
    .orderBy("student.id", "asc")
    .limit(SEARCH_LIMIT);
}

export async function searchStudents(input: {
  database: Database;
  values: z.infer<typeof studentSearchInputSchema>;
}): Promise<StudentSearchResult[]> {
  return studentSearchQuery(input.database, input.values.query).execute();
}
