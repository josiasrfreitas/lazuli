import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context, StaffUser } from "../trpc/context.js";
import { canAccess } from "../trpc/rbac.js";
import { readAnalytics } from "../finance/internal/analytics.js";
import { HOME_GROUPS, HOME_PREVIEW_SIZE } from "./home-model.js";
import { readHomePending } from "./home-pending.js";
import { readHomeAgenda } from "./home-schedule.js";
import { homePeriod, readHomeSchool, readBusinessComparison } from "./home-insights.js";

type HomeSummary = {
  today: string;
  updatedAt: string;
  name: string;
  activeStudents: number;
  school: Awaited<ReturnType<typeof readHomeSchool>>;
  canViewFinance: boolean;
  groups: Awaited<ReturnType<typeof readHomePending>>[];
  agenda: Awaited<ReturnType<typeof readHomeAgenda>>;
};
type HomeContext = { database: Context["db"]; now: Date; staffUser: StaffUser; month?: string };
export async function readAdminHome({
  database,
  now,
  staffUser,
  month,
}: HomeContext): Promise<HomeSummary> {
  const today = saoPauloDateOnly(now);
  const finance = canAccess(staffUser.role, "finance");
  const kinds = finance
    ? HOME_GROUPS
    : HOME_GROUPS.filter((kind) => kind !== "contracts" && kind !== "renewals");
  const [groups, agenda, activeStudents, school] = await Promise.all([
    Promise.all(
      kinds.map(async (kind) => {
        const records = kind === "lessons" || kind === "appointments";
        const group = await readHomePending(database, {
          kind,
          now,
          page: 1,
          pageSize: HOME_PREVIEW_SIZE,
          period: records ? "recent" : "all",
        });
        if (!records) return group;
        const history = await readHomePending(database, {
          kind,
          now,
          page: 1,
          pageSize: 0,
          period: "history",
        });
        return { ...group, historyTotal: history.total };
      }),
    ),
    readHomeAgenda(database, now),
    database.student.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    readHomeSchool(database, now, month),
  ]);
  return {
    today,
    updatedAt: now.toISOString(),
    name: staffUser.name,
    activeStudents,
    school,
    canViewFinance: finance,
    groups,
    agenda,
  };
}
/** Cash and commercial agreements stay separate; no accounting revenue is inferred. */
export async function readHomeBusiness(
  database: Context["db"],
  now: Date,
  requestedMonth?: string,
) {
  const period = homePeriod(now, requestedMonth);
  const [analytics, comparison] = await Promise.all([
    readAnalytics(database, { year: Number(period.month.slice(0, 4)), now }),
    readBusinessComparison(database, period),
  ]);
  const current = analytics.months.find((row) => row.month === period.month)!;
  return {
    month: period.month,
    through: period.through,
    previousThrough: period.previousThrough,
    partial: period.partial,
    newContracts: comparison.newContracts,
    renewals: comparison.renewals,
    receivedCents: current.receivedCents,
    expectedCents: current.expectedCents,
    overdueCents: analytics.overdueCents,
    overduePayers: analytics.overduePayers,
    aging: analytics.aging,
    receivedSeries: comparison.received,
    previousReceivedCents: comparison.previousReceivedCents,
    agreements: comparison.agreements,
    months: analytics.months.filter((row) => row.month <= period.month).slice(-6),
  };
}
