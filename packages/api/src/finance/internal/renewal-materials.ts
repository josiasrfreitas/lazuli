import type { FinanceDatabase } from "./shared.js";
import { contractMaterialOptions } from "./contract-materials.js";

export async function renewalMaterials(database: FinanceDatabase, contractId: string) {
  const [sales, catalog] = await Promise.all([
    database.materialOrder.findMany({
      where: { order: { contractId, deletedAt: null, cancelledAt: null } },
      include: {
        stage: { select: { id: true, trackId: true, sequence: true } },
        items: { include: { stage: { select: { id: true, trackId: true, sequence: true } } } },
      },
      orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }],
    }),
    contractMaterialOptions(database),
  ]);
  if (!sales.length) return null;
  const books = new Map(
    sales.flatMap((sale) =>
      (sale.items.length ? sale.items.map((item) => item.stage) : [sale.stage]).map(
        (stage) => [stage.id, stage] as const,
      ),
    ),
  );
  const tracks = new Map<string, { count: number; last: number }>();
  for (const book of books.values()) {
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
  const terms = sales[0]!;
  return {
    stageIds,
    missingCount: stageIds.filter((id) => !id).length,
    category: terms.category,
    payment: terms.payment,
    installmentCount: terms.quotedInstallments,
    scholarshipPct: Number(terms.scholarshipPct),
    scholarshipAgreement: terms.scholarshipAgreement,
    priceOverrideCents: terms.priceOverrideCents,
    cardFeePct: terms.cardFeePct === null ? null : Number(terms.cardFeePct),
  };
}
