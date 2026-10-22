import { studentFinancialActivityScope } from "./student-financial-scope.js";
import { searchIds } from "../search.js";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, saoPauloMidnightToInstant } from "@lazuli/domain";
import type { ActivityListInput } from "@lazuli/validators";
import { ACTIVITY_AREAS, type ActivityArea } from "./catalog.js";

const PERIOD_DAYS = { TODAY: 1, "7": 7, "30": 30, "90": 90 };
const select = {
  id: true,
  occurredAt: true,
  actorId: true,
  actorName: true,
  area: true,
  action: true,
  title: true,
  subjectType: true,
  subjectId: true,
  subjectName: true,
  description: true,
} satisfies Prisma.ActivityEventSelect;
type Event = Prisma.ActivityEventGetPayload<{ select: typeof select }>;
export type ActivityRow = Event & { areaLabel: string; href: string | null };
type ActivityCursor = NonNullable<ActivityListInput["cursor"]>;
type ActivityPage = { rows: ActivityRow[]; total: number; nextCursor: ActivityCursor | null };

export function activityPeriodStart(
  period: ActivityListInput["period"],
  now: Date,
): Date | undefined {
  if (period === "ALL") return undefined;
  const day = new Date(saoPauloDateOnly(now));
  day.setUTCDate(day.getUTCDate() - (PERIOD_DAYS[period] - 1));
  return saoPauloMidnightToInstant({
    year: day.getUTCFullYear(),
    monthIndex: day.getUTCMonth(),
    day: day.getUTCDate(),
  });
}
export async function listActivity(
  database: Prisma.TransactionClient,
  options: {
    input: ActivityListInput;
    now: Date;
  },
): Promise<ActivityPage> {
  const { input, now } = options;
  const snapshotAt = input.cursor && input.cursor.snapshotAt < now ? input.cursor.snapshotAt : now;
  const { where, studentScope } = await activityFilters(database, { input, snapshotAt });
  const [rows, total] = await Promise.all([
    database.activityEvent.findMany({
      where: activityPageWhere({ where, studentScope, cursor: input.cursor }),
      select,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.pageSize + 1,
    }),
    database.activityEvent.count({ where }),
  ]);
  const visible = rows.slice(0, input.pageSize);
  const last = visible.at(-1);
  const nextCursor =
    rows.length > input.pageSize && last
      ? { id: last.id, occurredAt: last.occurredAt, snapshotAt }
      : null;
  return {
    rows: visible.map((row) => ({
      ...row,
      areaLabel: ACTIVITY_AREAS[row.area as ActivityArea] ?? row.area,
      href: activityHref(row),
    })),
    total,
    nextCursor,
  };
}

async function activityFilters(
  database: Prisma.TransactionClient,
  options: { input: ActivityListInput; snapshotAt: Date },
): Promise<{
  where: Prisma.ActivityEventWhereInput;
  studentScope: Prisma.ActivityEventWhereInput | undefined;
}> {
  const { input, snapshotAt } = options;
  const start = activityPeriodStart(input.period, snapshotAt);
  const studentScope = input.financialStudentId
    ? await studentFinancialActivityScope(database, input.financialStudentId)
    : undefined;
  const areas = activityAreas(input);
  const actorIds = input.actorIds ?? (input.actorId ? [input.actorId] : []);
  return {
    studentScope,
    where: {
      ...(studentScope ? { AND: [studentScope] } : {}),
      deletedAt: null,
      occurredAt: { ...(start ? { gte: start } : {}), lte: snapshotAt },
      ...(areas.length > 0 ? { area: { in: areas } } : {}),
      ...(actorIds.length > 0 ? { actorId: { in: actorIds } } : {}),
      id: (await searchIds(database, { table: "ActivityEvent", query: input.search })) ?? {},
    },
  };
}

function activityAreas(input: ActivityListInput): ActivityArea[] {
  if (input.areas) return input.areas;
  return input.area === "ALL" ? [] : [input.area];
}

function activityPageWhere(options: {
  where: Prisma.ActivityEventWhereInput;
  studentScope: Prisma.ActivityEventWhereInput | undefined;
  cursor: ActivityListInput["cursor"];
}): Prisma.ActivityEventWhereInput {
  const { where, studentScope, cursor } = options;
  if (!cursor) return where;
  return {
    ...where,
    AND: [
      ...(studentScope ? [studentScope] : []),
      {
        OR: [
          { occurredAt: { lt: cursor.occurredAt } },
          { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
        ],
      },
    ],
  };
}
function activityHref(row: Event): string | null {
  if (row.subjectType === "contract") return "/contratos";
  if (row.subjectType === "receivable" || row.subjectType === "payer") return "/recebiveis";
  const routes: Record<string, string> = {
    student: "/alunos",
    class: "/turmas",
    teacher: "/professores",
    lead: "/interessados",
  };
  const route = routes[row.subjectType];
  return route && row.subjectId ? `${route}/${row.subjectId}` : null;
}
