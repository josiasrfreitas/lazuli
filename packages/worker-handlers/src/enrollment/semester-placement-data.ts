import type { Prisma } from "@lazuli/db";

export const include = {
  semester: true,
  plan: { select: { sourceClassId: true, startsOn: true, closedAt: true } },
  student: {
    include: {
      healthPending: true,
      contracts: {
        where: { deletedAt: null, terminatedAt: null },
        select: { startsOn: true, endsOn: true },
      },
    },
  },
  stage: { include: { track: true } },
  sourceEnrollment: { include: { class: true } },
  sourceProgress: { include: { stage: true, assessment: true } },
  enrollment: {
    include: {
      class: {
        include: {
          teacher: { include: { teacherProfile: true } },
          teacherAssignments: {
            where: { supersededAt: null, deletedAt: null },
            include: { teacher: { include: { teacherProfile: true } } },
          },
          scheduleSlots: { where: { deletedAt: null } },
        },
      },
    },
  },
  entryAction: true,
  sourceExitAction: true,
} satisfies Prisma.SemesterPlacementInclude;
export type Placement = Prisma.SemesterPlacementGetPayload<{ include: typeof include }>;

const DATE_ONLY_LENGTH = 10;
export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, DATE_ONLY_LENGTH);
}
