import type { Prisma, Student, TransactionClient } from "@lazuli/db";
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

function relevance<T>(field: RawBuilder<T>, query: string): RawBuilder<number> {
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

type LookupResult = {
  students: {
    id: string;
    name: string;
    status: Student["status"];
    classes: { id: string; name: string }[];
  }[];
  teachers: { id: string; name: string }[];
  classes: {
    id: string;
    name: string;
    code: string;
    semester: string;
    status: Prisma.ClassGetPayload<Record<string, never>>["status"];
  }[];
  leads: { id: string; name: string }[];
};

/** Bounded, read-only lookup. No document numbers, contact details or financial balances. */
export async function lookupCommands(
  database: TransactionClient,
  options: { query: string; now: Date },
): Promise<LookupResult> {
  const { query, now } = options;
  const today = new Date(saoPauloDateOnly(now));
  const [students, teachers, classes, leads] = await Promise.all([
    lookupStudents(database, { query, today }),
    lookupTeachers(database, query),
    lookupClasses(database, query),
    lookupLeads(database, query),
  ]);
  return { students, teachers, classes, leads };
}
async function lookupStudents(
  database: TransactionClient,
  options: { query: string; today: Date },
): Promise<LookupResult["students"]> {
  return database.$kysely
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
          .where("enrollment.entry_date", "<=", options.today)
          .where((where) =>
            where.or([
              where("enrollment.exit_date", "is", null),
              where("enrollment.exit_date", ">", options.today),
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
                  .where("action.effective_date", "<=", options.today),
              ),
            ),
          )
          .orderBy("enrollment.entry_date", "desc")
          .orderBy("enrollment.id", "asc")
          .limit(MAX_STUDENT_CLASSES),
      ).as("classes"),
    )
    .where("student.deleted_at", "is", null)
    .where(searchMatchKysely(sql.ref(STUDENT_FULL_NAME), options.query))
    .orderBy(relevance(sql.ref(STUDENT_FULL_NAME), options.query), "desc")
    .orderBy(STUDENT_FULL_NAME)
    .orderBy(STUDENT_ID)
    .limit(RESULT_LIMIT)
    .execute();
}

async function lookupTeachers(
  database: TransactionClient,
  query: string,
): Promise<LookupResult["teachers"]> {
  return database.$kysely
    .selectFrom("User")
    .select(["id", "name"])
    .where("deleted_at", "is", null)
    .where("role", "=", "TEACHER")
    .where(searchMatchKysely(sql.ref("name"), query))
    .orderBy(relevance(sql.ref("name"), query), "desc")
    .orderBy("name")
    .orderBy("id")
    .limit(RESULT_LIMIT)
    .execute();
}

async function lookupClasses(
  database: TransactionClient,
  query: string,
): Promise<LookupResult["classes"]> {
  return database.$kysely
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
    .execute();
}

async function lookupLeads(
  database: TransactionClient,
  query: string,
): Promise<LookupResult["leads"]> {
  return database.$kysely
    .selectFrom("AdmissionCandidate")
    .select(["id", "full_name as name"])
    .where("deleted_at", "is", null)
    .where(searchMatchKysely(sql.ref("full_name"), query))
    .orderBy(relevance(sql.ref("full_name"), query), "desc")
    .orderBy("full_name")
    .orderBy("id")
    .limit(RESULT_LIMIT)
    .execute();
}
