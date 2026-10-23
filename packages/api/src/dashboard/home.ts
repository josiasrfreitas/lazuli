import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context, StaffUser } from "../trpc/context.js";
import { canAccess } from "../trpc/rbac.js";
import { readAnalytics } from "../finance/internal/analytics.js";
import { HOME_GROUPS, HOME_PREVIEW_SIZE } from "./home-model.js";
import { readHomePending } from "./home-pending.js";
import { readHomeAgenda } from "./home-schedule.js";

const MONTH_LENGTH = 7;
const YEAR_LENGTH = 4;
type HomeSummary = {
  today: string;
  updatedAt: string;
  name: string;
  activeStudents: number;
  canViewFinance: boolean;
  groups: Awaited<ReturnType<typeof readHomePending>>[];
  agenda: Awaited<ReturnType<typeof readHomeAgenda>>;
};
type BusinessSummary = {
  month: string;
  newContracts: number;
  renewals: number;
  receivedCents: number;
  expectedCents: number;
  overdueCents: number;
  overduePayers: number;
  months: Awaited<ReturnType<typeof readAnalytics>>["months"];
};
type HomeContext = { database: Context["db"]; now: Date; staffUser: StaffUser };
export async function readAdminHome({
  database,
  now,
  staffUser,
}: HomeContext): Promise<HomeSummary> {
  const today = saoPauloDateOnly(now);
  const finance = canAccess(staffUser.role, "finance");
  const kinds = finance
    ? HOME_GROUPS
    : HOME_GROUPS.filter((kind) => kind !== "contracts" && kind !== "renewals");
  const [groups, agenda, activeStudents] = await Promise.all([
    Promise.all(
      kinds.map((kind) =>
        readHomePending(database, { kind, now, page: 1, pageSize: HOME_PREVIEW_SIZE }),
      ),
    ),
    readHomeAgenda(database, now),
    database.student.count({ where: { deletedAt: null, status: "ACTIVE" } }),
  ]);
  return {
    today,
    updatedAt: now.toISOString(),
    name: staffUser.name,
    activeStudents,
    canViewFinance: finance,
    groups,
    agenda,
  };
}
/** Cash and commercial agreements stay separate; no accounting revenue is inferred. */
export async function readHomeBusiness(
  database: Context["db"],
  now: Date,
): Promise<BusinessSummary> {
  const today = saoPauloDateOnly(now);
  const year = Number(today.slice(0, YEAR_LENGTH));
  const month = today.slice(0, MONTH_LENGTH);
  const period = { gte: new Date(`${month}-01`), lte: new Date(today) };
  const [analytics, contracts] = await Promise.all([
    readAnalytics(database, { year, now }),
    database.contract.groupBy({
      by: ["renewedFromId"],
      where: { deletedAt: null, agreedOn: period },
      _count: { id: true },
    }),
  ]);
  const current = analytics.months.find((row) => row.month === month)!;
  const newContracts = contracts
    .filter((row) => row.renewedFromId === null)
    .reduce((sum, row) => sum + row._count.id, 0);
  const renewals = contracts
    .filter((row) => row.renewedFromId !== null)
    .reduce((sum, row) => sum + row._count.id, 0);
  return {
    month,
    newContracts,
    renewals,
    receivedCents: current.receivedCents,
    expectedCents: current.expectedCents,
    overdueCents: analytics.overdueCents,
    overduePayers: analytics.overduePayers,
    months: analytics.months.filter((row) => row.month <= month),
  };
}
