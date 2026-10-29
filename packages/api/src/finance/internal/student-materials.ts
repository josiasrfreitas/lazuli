import { saoPauloDateOnly } from "@lazuli/domain";
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

/** Acquisition coverage crosses contract boundaries; no academic progression is inferred or written. */
export async function readStudentMaterials(
  database: FinanceDatabase,
  input: { studentId: string; now: Date },
) {
  const { studentId } = input;
  const student = await database.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const asOf = saoPauloDateOnly(input.now);
  const today = new Date(asOf);
  const [enrollments, placements, catalog, sales] = await Promise.all([
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
    database.materialOrder.findMany({
      where: {
        order: { deletedAt: null, cancelledAt: null, contract: { studentId, deletedAt: null } },
      },
      select: {
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
        order: { select: { createdAt: true } },
      },
      orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }],
    }),
  ]);
  const acquisitions = sales.map((sale) => ({
    id: sale.orderId,
    acquiredOn: saoPauloDateOnly(sale.order.createdAt),
    payment: sale.payment,
    chargedCents: sale.chargedAmountCents ?? 0,
    installmentCount: sale.quotedInstallments,
    books:
      sale.items.length > 0
        ? sale.items
        : [{ stageId: sale.stageId, name: sale.name, stageCode: sale.stageCode }],
  }));
  const acquired = new Set(acquisitions.flatMap((sale) => sale.books.map((book) => book.stageId)));
  const current: Coverage[] = [];
  const next: Coverage[] = [];
  const nextAcquisitions: Coverage[] = [];
  const coveredTracks = new Set<string>();
  const add = (book: Book, plannedId?: string | null, neededOn: string | null = null): void => {
    if (coveredTracks.has(book.trackId)) return;
    coveredTracks.add(book.trackId);
    const path = catalog.filter(
      (item) => item.trackId === book.trackId && item.sequence > book.sequence,
    );
    const planned = catalog.find((item) => item.id === plannedId);
    const following = planned ?? path[0];
    current.push(coverage(book, acquired, "CURRENT", null));
    if (following)
      next.push(coverage(following, acquired, planned ? "PLANNED" : "SEQUENCE", neededOn));
    const later = following
      ? catalog.filter(
          (item) => item.trackId === following.trackId && item.sequence > following.sequence,
        )
      : [];
    const missing = [book, ...(following ? [following] : []), ...later].find(
      (item) => !acquired.has(item.id),
    );
    if (missing)
      nextAcquisitions.push(
        coverage(
          missing,
          acquired,
          missing.id === book.id ? "CURRENT" : missing.id === planned?.id ? "PLANNED" : "SEQUENCE",
          missing.id === book.id ? asOf : missing.id === following?.id ? neededOn : null,
        ),
      );
  };
  for (const enrollment of enrollments) {
    const progress = enrollment.progressRecords[0];
    const book = catalog.find(
      (item) => item.id === (progress?.stage.id ?? enrollment.class.sharedStageId),
    );
    if (!book) continue;
    const plan =
      enrollment.class.scheduleType === "PERSONALIZED"
        ? progress?.stagePlan
        : enrollment.class.stagePlan;
    const validPlan = plan && !plan.deletedAt && plan.stageId === book.id;
    add(
      book,
      enrollment.sourceSemesterPlacements[0]?.stage?.id,
      validPlan ? toDateOnlyString(plan.plannedEndOn) : null,
    );
  }
  for (const placement of placements) {
    const book = catalog.find((item) => item.id === placement.stageId);
    if (book) add(book);
  }
  return {
    current,
    next,
    nextAcquisitions,
    acquisitions,
    acquiredCount: acquisitions.reduce((sum, sale) => sum + sale.books.length, 0),
    suggestedStageId: nextAcquisitions[0]?.id ?? null,
  };
}

function coverage(
  book: Book,
  acquired: Set<string>,
  source: Coverage["source"],
  neededOn: string | null,
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
