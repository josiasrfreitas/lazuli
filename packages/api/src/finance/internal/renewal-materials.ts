import type { Prisma } from "@lazuli/db";
import type { FinanceDatabase } from "./shared.js";
import { contractMaterialOptions } from "./contract-materials.js";

type MaterialTerms = Prisma.MaterialOrderGetPayload<Prisma.MaterialOrderDefaultArgs>;
type RenewalMaterials = {
  stageIds: string[];
  acquisitionSemesters: (number | null)[];
  missingCount: number;
  category: MaterialTerms["category"];
  payment: MaterialTerms["payment"];
  installmentCount: number;
  scholarshipPct: number;
  scholarshipAgreement: string | null;
  priceOverrideCents: number | null;
  cardFeePct: number | null;
};
type Stage = { id: string; trackId: string; sequence: number };

export async function renewalMaterials(
  database: FinanceDatabase,
  contractId: string,
): Promise<RenewalMaterials | null> {
  const [sales, catalog, planned] = await Promise.all([
    database.materialOrder.findMany({
      where: { order: { contractId, deletedAt: null, cancelledAt: null } },
      include: {
        stage: { select: { id: true, trackId: true, sequence: true } },
        items: { include: { stage: { select: { id: true, trackId: true, sequence: true } } } },
      },
      orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }],
    }),
    contractMaterialOptions(database),
    database.contractBook.findMany({
      where: { contractId },
      orderBy: { semester: "asc" },
      include: { stage: { select: { id: true, trackId: true, sequence: true } } },
    }),
  ]);
  if (sales.length === 0 && planned.length === 0) return null;
  const books = new Map(
    sales.flatMap((sale) =>
      (sale.items.length > 0 ? sale.items.map((item) => item.stage) : [sale.stage]).map(
        (stage) => [stage.id, stage] as const,
      ),
    ),
  );
  for (const slot of planned) if (slot.stage) books.set(slot.stage.id, slot.stage);
  const stageIds = suggestedStages(books.values(), { catalog, minimumSlots: planned.length });
  return {
    stageIds,
    acquisitionSemesters: planned.map((slot) => slot.acquisitionSemester),
    missingCount: stageIds.filter((id) => !id).length,
    ...renewalTerms(sales[0]),
  };
}

function suggestedStages(
  books: Iterable<Stage>,
  { catalog, minimumSlots }: { catalog: Stage[]; minimumSlots: number },
): string[] {
  const tracks = new Map<string, { count: number; last: number }>();
  for (const book of books) {
    const track = tracks.get(book.trackId) ?? { count: 0, last: -1 };
    tracks.set(book.trackId, { count: track.count + 1, last: Math.max(track.last, book.sequence) });
  }
  const stageIds: string[] = [];
  for (const [trackId, track] of tracks) {
    for (let offset = 1; offset <= track.count; offset++) {
      stageIds.push(
        catalog.find((stage) => stage.trackId === trackId && stage.sequence === track.last + offset)
          ?.id ?? "",
      );
    }
  }
  while (stageIds.length < minimumSlots) stageIds.push("");
  return stageIds;
}

function renewalTerms(
  terms: MaterialTerms | undefined,
): Omit<RenewalMaterials, "stageIds" | "acquisitionSemesters" | "missingCount"> {
  if (!terms) {
    return {
      category: "ADULT",
      payment: "CASH",
      installmentCount: 1,
      scholarshipPct: 0,
      scholarshipAgreement: null,
      priceOverrideCents: null,
      cardFeePct: null,
    };
  }
  return {
    category: terms.category,
    payment: terms.payment,
    installmentCount: terms.quotedInstallments,
    scholarshipPct: Number(terms.scholarshipPct),
    scholarshipAgreement: terms.scholarshipAgreement,
    priceOverrideCents: terms.priceOverrideCents,
    cardFeePct: terms.cardFeePct === null ? null : Number(terms.cardFeePct),
  };
}
