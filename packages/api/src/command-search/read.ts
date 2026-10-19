import type { TransactionClient } from "@lazuli/db";
import { normalizeSearch, saoPauloDateOnly } from "@lazuli/domain";
import { sql, type RawBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { normalizedKysely, searchMatchKysely } from "../search.js";

const RESULT_LIMIT = 6;

function relevance(field: RawBuilder<unknown>, query: string): RawBuilder<number> {
  const text = normalizedKysely(field);
  const needle = normalizeSearch(query);
  return sql<number>`case
    when ${text} = ${needle} then 1000
    when ${text} like ${`${needle}%`} then 800
    when strpos(${text}, ${needle}) > 0 then 600
    else word_similarity(${needle}, ${text}) * 400 end`;
}

/** Bounded, read-only lookup. No document numbers, contact details or financial balances. */
export async function lookupCommands(database: TransactionClient, query: string, now: Date) {
  const db = database.$kysely;
  const today = new Date(saoPauloDateOnly(now));
  const [students, teachers, classes, leads] = await Promise.all([
    db
      .selectFrom("Student as student")
      .select(["student.id", "student.full_name as name", "student.status"])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom("Enrollment as enrollment")
            .innerJoin("Class as class", "class.id", "enrollment.class_id")
            .select(["class.id", "class.portal_class_name as name"])
            .whereRef("enrollment.student_id", "=", "student.id")
            .where("enrollment.deleted_at", "is", null)
            .where("class.deleted_at", "is", null)
            .where("enrollment.entry_date", "<=", today)
            .where((where) =>
              where.or([
                where("enrollment.exit_date", "is", null),
                where("enrollment.exit_date", ">", today),
              ]),
            )
            .where((where) =>
              where.not(
                where.exists(
                  where
                    .selectFrom("EnrollmentAction as action")
                    .select("action.id")
                    .whereRef("action.enrollment_id", "=", "enrollment.id")
                    .where("action.deleted_at", "is", null)
                    .where("action.status", "=", "SCHEDULED")
                    .where("action.kind", "in", ["PAUSE", "EXIT"])
                    .where("action.effective_date", "<=", today),
                ),
              ),
            )
            .orderBy("enrollment.entry_date", "desc")
            .orderBy("enrollment.id", "asc")
            .limit(3),
        ).as("classes"),
      )
      .where("student.deleted_at", "is", null)
      .where(searchMatchKysely(sql.ref("student.full_name"), query))
      .orderBy(relevance(sql.ref("student.full_name"), query), "desc")
      .orderBy("student.full_name")
      .orderBy("student.id")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("User")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .where("role", "=", "TEACHER")
      .where(searchMatchKysely(sql.ref("name"), query))
      .orderBy(relevance(sql.ref("name"), query), "desc")
      .orderBy("name")
      .orderBy("id")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("Class as class")
      .innerJoin("Semester as semester", "semester.id", "class.semester_id")
      .select([
        "class.id",
        "class.portal_class_name as name",
        "class.internal_code as code",
        "semester.name as semester",
        "class.status",
      ])
      .where("class.deleted_at", "is", null)
      .where("semester.deleted_at", "is", null)
      .where((eb) =>
        eb.or([
          searchMatchKysely(sql.ref("class.portal_class_name"), query),
          searchMatchKysely(sql.ref("class.internal_code"), query),
        ]),
      )
      .orderBy(relevance(sql.ref("class.portal_class_name"), query), "desc")
      .orderBy("class.portal_class_name")
      .orderBy("class.id")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("AdmissionCandidate")
      .select(["id", "full_name as name"])
      .where("deleted_at", "is", null)
      .where(searchMatchKysely(sql.ref("full_name"), query))
      .orderBy(relevance(sql.ref("full_name"), query), "desc")
      .orderBy("full_name")
      .orderBy("id")
      .limit(RESULT_LIMIT)
      .execute(),
  ]);
  return { students, teachers, classes, leads };
}
