import { purchasedBooks, studentMaterialSaleWhere } from "@lazuli/db/material-purchases";
import { ledgerQuery } from "./installments-query.js";
import { toPublicRow } from "../installments-groups.js";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { contractSelect, orderFinancialSummary } from "./contracts-select.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { notFound } from "../../trpc/errors.js";
import { contractMaterialOptions } from "./contract-materials.js";
import { activeEnrollments } from "./material-needs.js";
import { STUDENT_NOT_FOUND_MESSAGE, toDateOnlyString, type FinanceDatabase } from "./shared.js";

type Book = Awaited<ReturnType<typeof contractMaterialOptions>>[number];
type Coverage = {
  id: string;
  name: string;
  code: string;
  acquired: boolean;
  source: "CURRENT" | "PLANNED" | "SEQUENCE";
  neededOn: string | null;
};

const installments = contractSelect.orders.select.installments;
const allocations = installments.select.allocations;
const materialSaleSelect = {
  orderId: true,
  stageId: true,
  name: true,
  stageCode: true,
  payment: true,
  chargedAmountCents: true,
  quotedInstallments: true,
  scholarshipPct: true,
  items: {
    orderBy: { position: "asc" },
    select: { stageId: true, name: true, stageCode: true },
  },
  order: {
    select: {
      ...contractSelect.orders.select,
      createdAt: true,
      contractId: true,
      installments: {
        ...installments,
        select: {
          ...installments.select,
          allocations: {
            ...allocations,
            select: {
              ...allocations.select,
              paymentEntry: { select: { date: true, paymentMethod: { select: { name: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MaterialOrderSelect;
type MaterialSale = Prisma.MaterialOrderGetPayload<{ select: typeof materialSaleSelect }>;
type Acquisition = {
  id: string;
  acquiredOn: string;
  contractId: string | null;
  balanceCents: number;
  lastReceipt: { date: string; method: string } | null;
  payment: MaterialSale["payment"];
  chargedCents: number;
  installmentCount: number;
  books: Array<{ stageId: string; name: string; stageCode: string }>;
};
type StudentMaterialsResult = {
  current: Coverage[];
  next: Coverage[];
  nextAcquisitions: Coverage[];
  acquisitions: Acquisition[];
  openMaterialRows: FinanceInstallmentRow[];
  plannedBooks: {
    contractId: string;
    semester: number;
    stageId: string | null;
    name: string | null;
    acquisitionSemester: number | null;
    agreedPriceCents: number | null;
    acquired: boolean;
  }[];
  acquiredCount: number;
  suggestedStageId: string | null;
};

/** Acquisition coverage crosses contract boundaries; no academic progression is inferred or written. */
export async function readStudentMaterials(
  database: FinanceDatabase,
  input: { studentId: string; now: Date },
): Promise<StudentMaterialsResult> {
  const { studentId } = input;
  const student = await database.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const asOf = saoPauloDateOnly(input.now);
  const today = new Date(asOf);
  const [enrollments, placements, catalog, sales, slots] = await Promise.all([
    activeEnrollments(database, { studentId, today }),
    database.semesterPlacement.findMany({
      where: {
        studentId,
        deletedAt: null,
        declinedAt: null,
        enrollmentId: null,
        stageId: { not: null },
        semester: { deletedAt: null, endDate: { gte: today } },
      },
      select: { stageId: true, trackId: true },
      orderBy: [{ semester: { startDate: "asc" } }, { updatedAt: "desc" }, { id: "asc" }],
    }),
    contractMaterialOptions(database),
    materialSales(database, studentId),
    database.contractBook.findMany({
      where: {
        contract: { studentId, deletedAt: null, terminatedAt: null, endsOn: { gte: today } },
      },
      select: {
        contractId: true,
        semester: true,
        stageId: true,
        acquisitionSemester: true,
        agreedPriceCents: true,
        stage: { select: { name: true } },
      },
      orderBy: [{ contract: { startsOn: "asc" } }, { semester: "asc" }],
    }),
  ]);
  const acquisitions = sales.map((sale) => toAcquisition(sale, input.now));
  const acquired = new Set(acquisitions.flatMap((sale) => sale.books.map((book) => book.stageId)));
  const { current, next, nextAcquisitions, add } = createCollector({ catalog, acquired, asOf });
  applyCoverage({ enrollments, placements, catalog, add });
  const unpaidOrders = acquisitions.filter((sale) => sale.balanceCents > 0).map((sale) => sale.id);
  const openMaterialRows = await openMaterialBalances(database, {
    studentId,
    fullName: student.fullName,
    asOf,
    unpaidOrders,
  });
  return {
    openMaterialRows,
    plannedBooks: slots.map((slot) => ({
      contractId: slot.contractId,
      semester: slot.semester,
      stageId: slot.stageId,
      name: slot.stage?.name ?? null,
      acquisitionSemester: slot.acquisitionSemester,
      agreedPriceCents: slot.agreedPriceCents,
      acquired: Boolean(slot.stageId && acquired.has(slot.stageId)),
    })),
    current,
    next,
    nextAcquisitions,
    acquisitions,
    acquiredCount: acquisitions.reduce((sum, sale) => sum + sale.books.length, 0),
    suggestedStageId: nextAcquisitions[0]?.id ?? null,
  };
}

async function openMaterialBalances(
  database: FinanceDatabase,
  {
    studentId,
    fullName,
    asOf,
    unpaidOrders,
  }: { studentId: string; fullName: string; asOf: string; unpaidOrders: string[] },
): Promise<FinanceInstallmentRow[]> {
  const openRows =
    unpaidOrders.length > 0
      ? await ledgerQuery({
          kysely: database.$kysely,
          businessDate: asOf,
          studentId,
          search: undefined,
        })
          .selectFrom("ledger")
          .selectAll()
          .where("orderId", "in", unpaidOrders)
          .where("collectibleBalanceCents", ">", 0)
          .orderBy("dueDate")
          .execute()
      : [];
  const beneficiaries = {
    byOrder: new Map(
      unpaidOrders.map((id) => [id, [{ studentId: studentId, fullName: fullName }]]),
    ),
    ordered: [],
  };
  return openRows.map((row) => toPublicRow(row, beneficiaries));
}

function toAcquisition(sale: MaterialSale, now: Date): Acquisition {
  const { financialSummary } = orderFinancialSummary(sale.order, now);
  const receipts = sale.order.installments
    .flatMap((line) => line.allocations)
    .filter(
      (row) =>
        row.amountCents > row.reversals.reduce((sum, reversal) => sum + reversal.amountCents, 0),
    )
    .map((row) => row.paymentEntry)
    .toSorted((left, right) => right.date.getTime() - left.date.getTime());
  const latest = receipts[0];
  return {
    id: sale.orderId,
    lastReceipt: latest
      ? { date: toDateOnlyString(latest.date), method: latest.paymentMethod.name }
      : null,
    contractId: sale.order.contractId,
    balanceCents:
      financialSummary.overdueCents + financialSummary.futureCents + financialSummary.dueTodayCents,
    acquiredOn: saoPauloDateOnly(sale.order.createdAt),
    payment: sale.payment,
    chargedCents: sale.chargedAmountCents ?? 0,
    installmentCount: sale.quotedInstallments,
    books: purchasedBooks(sale.items, {
      stageId: sale.stageId,
      name: sale.name,
      stageCode: sale.stageCode,
    }),
  };
}

function applyCoverage({
  enrollments,
  placements,
  catalog,
  add,
}: {
  enrollments: Awaited<ReturnType<typeof activeEnrollments>>;
  placements: Array<{ stageId: string | null }>;
  catalog: Book[];
  add: Collector["add"];
}): void {
  for (const enrollment of enrollments) applyEnrollment(enrollment, { catalog, add });
  for (const placement of placements) {
    const book = catalog.find((item) => item.id === placement.stageId);
    if (book) add(book);
  }
}

function applyEnrollment(
  enrollment: Awaited<ReturnType<typeof activeEnrollments>>[number],
  { catalog, add }: { catalog: Book[]; add: Collector["add"] },
): void {
  const progress = enrollment.progressRecords[0];
  const book = catalog.find(
    (item) => item.id === (progress?.stage.id ?? enrollment.class.sharedStageId),
  );
  if (!book) return;
  const plan =
    enrollment.class.scheduleType === "PERSONALIZED"
      ? progress?.stagePlan
      : enrollment.class.stagePlan;
  const validPlan = plan && !plan.deletedAt && plan.stageId === book.id;
  add(book, {
    plannedId: enrollment.sourceSemesterPlacements[0]?.stage?.id,
    neededOn: validPlan ? toDateOnlyString(plan.plannedEndOn) : null,
  });
}

async function materialSales(
  database: FinanceDatabase,
  studentId: string,
): Promise<MaterialSale[]> {
  return database.materialOrder.findMany({
    where: studentMaterialSaleWhere([studentId]),
    select: materialSaleSelect,
    orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }],
  });
}

type Collector = {
  current: Coverage[];
  next: Coverage[];
  nextAcquisitions: Coverage[];
  add: (
    book: Book,
    options?: { plannedId?: string | null | undefined; neededOn?: string | null },
  ) => void;
};

function createCollector({
  catalog,
  acquired,
  asOf,
}: {
  catalog: Book[];
  acquired: Set<string>;
  asOf: string;
}): Collector {
  const current: Coverage[] = [];
  const next: Coverage[] = [];
  const nextAcquisitions: Coverage[] = [];
  const coveredTracks = new Set<string>();
  const add = (
    book: Book,
    options: { plannedId?: string | null | undefined; neededOn?: string | null } = {},
  ): void => {
    const { plannedId, neededOn = null } = options;
    if (coveredTracks.has(book.trackId)) return;
    coveredTracks.add(book.trackId);
    const planned = catalog.find((item) => item.id === plannedId);
    const following =
      planned ??
      catalog.find((item) => item.trackId === book.trackId && item.sequence > book.sequence);
    current.push(coverage(book, { acquired, source: "CURRENT", neededOn: null }));
    if (following)
      next.push(
        coverage(following, {
          acquired,
          source: planned ? "PLANNED" : "SEQUENCE",
          neededOn,
        }),
      );
    const later = laterBooks(catalog, following);
    const missing = [book, ...(following ? [following] : []), ...later].find(
      (item) => !acquired.has(item.id),
    );
    if (missing)
      nextAcquisitions.push(
        coverage(missing, {
          acquired,
          source: coverageSource(missing, { book, planned }),
          neededOn: coverageDate(missing, { book, following, asOf, neededOn }),
        }),
      );
  };
  return { current, next, nextAcquisitions, add };
}

function laterBooks(catalog: Book[], following: Book | undefined): Book[] {
  if (!following) return [];
  return catalog.filter(
    (item) => item.trackId === following.trackId && item.sequence > following.sequence,
  );
}

function coverageSource(
  missing: Book,
  { book, planned }: { book: Book; planned: Book | undefined },
): Coverage["source"] {
  if (missing.id === book.id) return "CURRENT";
  return missing.id === planned?.id ? "PLANNED" : "SEQUENCE";
}

function coverageDate(
  missing: Book,
  {
    book,
    following,
    asOf,
    neededOn,
  }: { book: Book; following: Book | undefined; asOf: string; neededOn: string | null },
): string | null {
  if (missing.id === book.id) return asOf;
  return missing.id === following?.id ? neededOn : null;
}

function coverage(
  book: Book,
  { acquired, source, neededOn }: Pick<Coverage, "source" | "neededOn"> & { acquired: Set<string> },
): Coverage {
  return {
    id: book.id,
    name: book.name,
    code: book.internalCode,
    acquired: acquired.has(book.id),
    source,
    neededOn,
  };
}
