import type { TransactionClient } from "@lazuli/db";
import { normalizeSearch, saoPauloDateOnly } from "@lazuli/domain";
import { sql, type RawBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { normalizedKysely, searchMatchKysely } from "../search.js";

const MAX_STUDENT_CLASSES = 3;

const RESULT_LIMIT = 6;
const STUDENT_ID = "student.id";
const STUDENT_FULL_NAME = "student.full_name";
const CLASS_ID = "class.id";
const CLASS_PORTAL_NAME = "class.portal_class_name";

function relevance(field: RawBuilder<unknown>, query: string): RawBuilder<number> {
  const text = normalizedKysely(field);
  const needle = normalizeSearch(query);
  return sql<number>`
    case
        when ${text} = ${needle} then 1000
        when ${text} like ${`${needle}%`} then 800
        when strpos(${text}, ${needle}) > 0 then 600
        else word_similarity(${needle}, ${text}) * 400 end
  `;
}

/** Bounded, read-only lookup. No document numbers, contact details or financial balances. */
export async function lookupCommands(
  database: TransactionClient,
  options: {
    query: string;
    now: Date;
  },
) {
  const { query, now } = options;

  const db = database.$kysely;
  const today = new Date(saoPauloDateOnly(now));
  const [students, teachers, classes, leads] = await Promise.all([
    db
      .selectFrom("Student as student")
      .select([STUDENT_ID, "student.full_name as name", "student.status"])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom("Enrollment as enrollment")
            .innerJoin("Class as class", CLASS_ID, "enrollment.class_id")
            .select([CLASS_ID, "class.portal_class_name as name"])
            .whereRef("enrollment.student_id", "=", STUDENT_ID)
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
            .limit(MAX_STUDENT_CLASSES),
        ).as("classes"),
      )
      .where("student.deleted_at", "is", null)
      .where(searchMatchKysely(sql.ref(STUDENT_FULL_NAME), query))
      .orderBy(relevance(sql.ref(STUDENT_FULL_NAME), query), "desc")
      .orderBy(STUDENT_FULL_NAME)
      .orderBy(STUDENT_ID)
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
        CLASS_ID,
        "class.portal_class_name as name",
        "class.internal_code as code",
        "semester.name as semester",
        "class.status",
      ])
      .where("class.deleted_at", "is", null)
      .where("semester.deleted_at", "is", null)
      .where((eb) =>
        eb.or([
          searchMatchKysely(sql.ref(CLASS_PORTAL_NAME), query),
          searchMatchKysely(sql.ref("class.internal_code"), query),
        ]),
      )
      .orderBy(relevance(sql.ref(CLASS_PORTAL_NAME), query), "desc")
      .orderBy(CLASS_PORTAL_NAME)
      .orderBy(CLASS_ID)
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
