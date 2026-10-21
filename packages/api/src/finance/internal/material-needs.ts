import { stageMaterialAttention } from "@lazuli/domain";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

/** Read academic plans and organization decisions; finance never advances an enrollment. */
export async function readMaterialNeeds(
  database: FinanceDatabase,
  options: {
    studentId: string;
    asOf: string;
  },
) {
  const { studentId, asOf } = options;

  const today = new Date(asOf);
  const [enrollments, sales] = await Promise.all([
    database.enrollment.findMany({
      where: {
        studentId,
        deletedAt: null,
        entryDate: { lte: today },
        OR: [{ exitDate: null }, { exitDate: { gt: today } }],
        class: { deletedAt: null },
      },
      select: {
        id: true,
        class: {
          select: {
            id: true,
            portalClassName: true,
            scheduleType: true,
            sharedStageId: true,
            stagePlan: { select: { stageId: true, plannedEndOn: true, deletedAt: true } },
          },
        },
        sourceSemesterPlacements: {
          where: {
            deletedAt: null,
            declinedAt: null,
            semester: { deletedAt: null },
            OR: [
              { effectiveDate: { gt: today } },
              { effectiveDate: null, semester: { startDate: { gt: today } } },
            ],
          },
          orderBy: [{ semester: { startDate: "asc" } }, { effectiveDate: "asc" }, { id: "asc" }],
          take: 1,
          select: { stage: { select: { id: true, name: true } } },
        },
        progressRecords: {
          where: {
            deletedAt: null,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gt: today } }],
          },
          orderBy: [{ startDate: "desc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true,
            stage: { select: { id: true, name: true, trackId: true, sequence: true } },
            stagePlan: {
              select: { studentId: true, stageId: true, plannedEndOn: true, deletedAt: true },
            },
          },
        },
      },
    }),
    database.materialOrder.findMany({
      where: {
        order: { deletedAt: null, cancelledAt: null, contract: { studentId, deletedAt: null } },
      },
      select: { stageId: true, items: { select: { stageId: true } } },
    }),
  ]);
  const acquiredStageIds = sales.flatMap((sale) =>
    sale.items.length > 0 ? sale.items.map((item) => item.stageId) : [sale.stageId],
  );
  const tracks = [
    ...new Set(
      enrollments.flatMap((row) => row.progressRecords.map((progress) => progress.stage.trackId)),
    ),
  ];
  const stages =
    tracks.length > 0
      ? await database.stage.findMany({
          where: { trackId: { in: tracks }, deletedAt: null },
          select: { id: true, name: true, sequence: true, trackId: true },
          orderBy: { sequence: "asc" },
        })
      : [];
  return enrollments.flatMap((enrollment) => {
    const progress = enrollment.progressRecords[0];
    if (!progress) return [];
    const ppt = enrollment.class.scheduleType === "PERSONALIZED";
    const plan = ppt ? progress.stagePlan : enrollment.class.stagePlan;
    if (!plan || plan.deletedAt || plan.stageId !== progress.stage.id) return [];
    if (ppt && progress.stagePlan?.studentId !== studentId) return [];
    const organization = enrollment.sourceSemesterPlacements[0];
    const successor = stages.find(
      (stage) =>
        stage.trackId === progress.stage.trackId && stage.sequence > progress.stage.sequence,
    );
    const next = ppt ? successor : organization?.stage;
    // There is no next book to predict at the end of the known PPT track.
    if (ppt && !successor) return [];
    const plannedEndOn = toDateOnlyString(plan.plannedEndOn);
    const attention = stageMaterialAttention({
      asOf,
      plannedEndOn,
      currentStageId: progress.stage.id,
      nextStageId: next?.id ?? null,
      acquiredStageIds,
    });
    if (!attention) return [];
    return [
      {
        id: progress.id,
        classId: enrollment.class.id,
        className: enrollment.class.portalClassName,
        mode: enrollment.class.scheduleType,
        currentStage: progress.stage.name,
        nextStage: next?.name ?? null,
        plannedEndOn,
        ...attention,
      },
    ];
  });
}
