import { Prisma } from "@lazuli/db/prisma";
import { normalizeSearch } from "@lazuli/domain";
import { sql, type RawBuilder } from "kysely";
const searchColumns = {
  Student: ["full_name"],
  User: ["name"],
  Class: ["internal_code", "portal_class_name"],
  Payer: ["name"],
  ActivityEvent: ["title", "subject_name", "actor_name", "description"],
} as const;
/** PostgreSQL 16 NFD, accents and punctuation; same comparison key as normalizeSearch. */
export function normalizedSql(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`regexp_replace(lower(regexp_replace(normalize(coalesce(${value}, ''), NFD), '[̀-ͯ]', '', 'g')), '[^[:alnum:]]', '', 'g')`;
}
export function normalizedKysely(value: RawBuilder<string | null>): RawBuilder<string> {
  return sql<string>`regexp_replace(lower(regexp_replace(normalize(coalesce(${value}, ''), NFD), '[̀-ͯ]', '', 'g')), '[^[:alnum:]]', '', 'g')`;
}
const FUZZY_THRESHOLD = 0.6;
const FUZZY_MIN_LENGTH = 4;
function allowsFuzzy(needle: string): boolean {
  return needle.length >= FUZZY_MIN_LENGTH && /^[\p{L}]+$/u.test(needle);
}
export function searchMatchSql(value: Prisma.Sql, query: string): Prisma.Sql {
  const needle = normalizeSearch(query);
  const normalized = normalizedSql(value);
  const exact = Prisma.sql`strpos(${normalized}, ${needle}) > 0`;
  return allowsFuzzy(needle)
    ? Prisma.sql`(${exact} OR word_similarity(${needle}, ${normalized}) > ${FUZZY_THRESHOLD})`
    : exact;
}
export function searchMatchKysely(
  value: RawBuilder<string | null>,
  query: string,
): RawBuilder<boolean> {
  const needle = normalizeSearch(query);
  const normalized = normalizedKysely(value);
  const exact = sql<boolean>`strpos(${normalized}, ${needle}) > 0`;
  return allowsFuzzy(needle)
    ? sql<boolean>`(${exact} OR word_similarity(${needle}, ${normalized}) > ${FUZZY_THRESHOLD})`
    : exact;
}
/** Return IDs only; callers retain their authorization, relation and pagination predicates. */
export async function searchIds(
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  {
    table,
    query,
  }: {
    table: keyof typeof searchColumns;
    query: string | undefined;
  },
): Promise<
  | {
      in: string[];
    }
  | undefined
> {
  const needle = normalizeSearch(query ?? "");
  if (!needle) return undefined;
  const conditions = searchColumns[table].map((column) =>
    searchMatchSql(Prisma.raw(`"${column}"`), needle),
  );
  const rows = await database.$queryRaw<
    {
      id: string;
    }[]
  >(Prisma.sql`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE deleted_at IS NULL AND (${Prisma.join(conditions, " OR ")})
  `);
  return { in: rows.map((row) => row.id) };
}
