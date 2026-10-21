import { Prisma } from "@lazuli/db/prisma";
import { normalizeSearch } from "@lazuli/domain";
import { sql, type RawBuilder } from "kysely";

const searchColumns = {
  Student: ["full_name"],
  User: ["name"],
  Class: ["internal_code", "portal_class_name"],
  Payer: ["name"],
  ActivityEvent: ["title", "subject_name", "actor_name", "description"],
  AdmissionCandidate: ["full_name", "phone", "email", "contact_name"],
  PedagogicalOccurrence: ["title"],
  PedagogicalIntervention: ["title"],
} as const;

/** PostgreSQL 16 NFD, accents and punctuation; same comparison key as normalizeSearch. */
export function normalizedSql(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`regexp_replace(lower(regexp_replace(normalize(coalesce(${value}, ''), NFD), '[̀-ͯ]', '', 'g')), '[^[:alnum:]]', '', 'g')`;
}
export function normalizedKysely(value: RawBuilder<unknown>): RawBuilder<string> {
  return sql<string>`regexp_replace(lower(regexp_replace(normalize(coalesce(${value}, ''), NFD), '[̀-ͯ]', '', 'g')), '[^[:alnum:]]', '', 'g')`;
}

const FUZZY_THRESHOLD = 0.6;
function allowsFuzzy(query: string): boolean {
  return normalizeSearch(query).length >= 4 && /^[\p{L}]+$/u.test(query.trim());
}

export function searchMatchSql(value: Prisma.Sql, query: string): Prisma.Sql {
  const needle = normalizeSearch(query);
  const normalized = normalizedSql(value);
  const exact = Prisma.sql`strpos(${normalized}, ${needle}) > 0`;
  return allowsFuzzy(query)
    ? Prisma.sql`(${exact} OR word_similarity(${needle}, ${normalized}) > ${FUZZY_THRESHOLD})`
    : exact;
}

export function searchMatchKysely(value: RawBuilder<unknown>, query: string): RawBuilder<boolean> {
  const needle = normalizeSearch(query);
  const normalized = normalizedKysely(value);
  const exact = sql<boolean>`strpos(${normalized}, ${needle}) > 0`;
  return allowsFuzzy(query)
    ? sql<boolean>`(${exact} OR word_similarity(${needle}, ${normalized}) > ${FUZZY_THRESHOLD})`
    : exact;
}

/** Return IDs only; callers retain their authorization, relation and pagination predicates. */
export async function searchIds(
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  options: {
    table: keyof typeof searchColumns;
    query: string | undefined;
  },
): Promise<{ in: string[] } | undefined> {
  const { table, query } = options;

  const needle = normalizeSearch(query ?? "");
  if (!needle) return undefined;
  const conditions = searchColumns[table].map((column) =>
    searchMatchSql(Prisma.raw(`"${column}"`), query ?? ""),
  );
  const rows = await database.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE deleted_at IS NULL AND (${Prisma.join(conditions, " OR ")})
  `);
  return { in: rows.map((row) => row.id) };
}
