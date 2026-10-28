import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context, StaffUser } from "../trpc/context.js";
import { canAccess } from "../trpc/rbac.js";
import { readAnalytics } from "../finance/internal/analytics.js";
import { HOME_GROUPS, HOME_PREVIEW_SIZE } from "./home-model.js";
import { readHomePending } from "./home-pending.js";
import { readHomeAgenda } from "./home-schedule.js";
import { homePeriod, readHomeSchool, readBusinessComparison } from "./home-insights.js";
import { readStudentAges, readLeadConversion } from "./home-audience.js";

type HomeSummary = {
  today: string;
  updatedAt: string;
  name: string;
  activeStudents: number;
  studentAges: Awaited<ReturnType<typeof readStudentAges>>["groups"];
  leadConversion: Awaited<ReturnType<typeof readLeadConversion>>;
  school: Awaited<ReturnType<typeof readHomeSchool>>;
  canViewFinance: boolean;
  groups: Awaited<ReturnType<typeof readHomePending>>[];
  agenda: Awaited<ReturnType<typeof readHomeAgenda>>;
};
type HomeContext = { database: Context["db"]; now: Date; staffUser: StaffUser; month?: string };
type Analytics = Awaited<ReturnType<typeof readAnalytics>>;
type Comparison = Awaited<ReturnType<typeof readBusinessComparison>>;
type HomeBusiness = {
  month: string;
  through: string;
  previousThrough: string;
  partial: boolean;
  newContracts: number;
  renewals: number;
  receivedCents: number;
  expectedCents: number;
  overdueCents: number;
  overduePayers: number;
  aging: Analytics["aging"];
  receivedSeries: Comparison["received"];
  previousReceivedCents: number;
  agreements: Comparison["agreements"];
  months: Analytics["months"];
};
const YEAR_LENGTH = 4;
const REPORT_MONTHS = 6;
const CONTRACT_REPORT_MONTHS = 8;
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
  const [groups, agenda, audience, school, leadConversion] = await Promise.all([
    readHomeGroups(database, { now, kinds }),
    readHomeAgenda(database, now),
    readStudentAges(database, now),
    readHomeSchool({ database, now, requestedMonth: month }),
    readLeadConversion(database, homePeriod(now, { requestedMonth: month })),
  ]);
  return {
    today,
    updatedAt: now.toISOString(),
    name: staffUser.name,
    activeStudents: audience.total,
    studentAges: audience.groups,
    leadConversion,
    school,
    canViewFinance: finance,
    groups,
    agenda,
  };
}

function readHomeGroups(
  database: Context["db"],
  { now, kinds }: { now: Date; kinds: readonly (typeof HOME_GROUPS)[number][] },
): Promise<Awaited<ReturnType<typeof readHomePending>>[]> {
  return Promise.all(
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
        pageSize: 1,
        period: "history",
      });
      return {
        ...group,
        historyTotal: history.total,
        ...(history.items[0] ? { historyItem: history.items[0] } : {}),
      };
    }),
  );
}
/** Cash and commercial agreements stay separate; no accounting revenue is inferred. */
export async function readHomeBusiness({
  database,
  now,
  requestedMonth,
}: {
  database: Context["db"];
  now: Date;
  requestedMonth?: string | undefined;
}): Promise<HomeBusiness> {
  const period = homePeriod(now, { requestedMonth });
  const [analytics, comparison] = await Promise.all([
    readAnalytics(database, { year: Number(period.month.slice(0, YEAR_LENGTH)), now }),
    readBusinessComparison(database, {
      period,
      contractPeriod: homePeriod(now, { requestedMonth, seriesMonths: CONTRACT_REPORT_MONTHS }),
    }),
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
    months: analytics.months.filter((row) => row.month <= period.month).slice(-REPORT_MONTHS),
  };
}
