import type { FinanceDatabase } from "./shared.js";
import { contractMaterialOptions } from "./contract-materials.js";

export async function renewalMaterials(database: FinanceDatabase, contractId: string) {
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
  if (!sales.length && !planned.length) return null;
  const books = new Map(
    sales.flatMap((sale) =>
      (sale.items.length ? sale.items.map((item) => item.stage) : [sale.stage]).map(
        (stage) => [stage.id, stage] as const,
      ),
    ),
  );
  for (const slot of planned) if (slot.stage) books.set(slot.stage.id, slot.stage);
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
  while (stageIds.length < planned.length) stageIds.push("");
  const terms = sales[0];
  return {
    stageIds,
    acquisitionSemesters: planned.map((slot) => slot.acquisitionSemester),
    missingCount: stageIds.filter((id) => !id).length,
    category: terms?.category ?? "ADULT",
    payment: terms?.payment ?? "CASH",
    installmentCount: terms?.quotedInstallments ?? 1,
    scholarshipPct: Number(terms?.scholarshipPct ?? 0),
    scholarshipAgreement: terms?.scholarshipAgreement ?? null,
    priceOverrideCents: terms?.priceOverrideCents ?? null,
    cardFeePct: terms?.cardFeePct == null ? null : Number(terms.cardFeePct),
  };
}
