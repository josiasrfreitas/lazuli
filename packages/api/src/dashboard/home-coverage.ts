import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  assignedTeacherIdOn,
  responsibilitySelect,
  usualTeacherOn,
} from "../teachers/responsibility.js";
import { dateOnly, linkItem, plusDays, type HomeItem } from "./home-model.js";

const DEPARTURE_HORIZON_DAYS = 15;
const coverageSelect = {
  semester: { select: { startDate: true, endDate: true } },
  ...responsibilitySelect,
} satisfies Prisma.ClassSelect;

/** One pending item per departing teacher while at least one class still needs a successor. */
export async function readCoverage(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<HomeItem[]> {
  const today = saoPauloDateOnly(now);
  const horizon = plusDays(today, DEPARTURE_HORIZON_DAYS);
  const departing = await database.teacherProfile.findMany({
    where: {
      deletedAt: null,
      departureDate: { not: null, lte: new Date(horizon) },
      user: { deletedAt: null },
    },
    select: {
      userId: true,
      departureDate: true,
      user: { select: { name: true } },
    },
    orderBy: [{ departureDate: "asc" }, { userId: "asc" }],
  });
  if (departing.length === 0) return [];

  const teacherIds = departing.map((profile) => profile.userId);
  const classes = await coverageClasses(database, { teacherIds, horizon, today });

  return departing.flatMap((profile) => {
    if (!profile.departureDate) return [];
    const departure = dateOnly(profile.departureDate);
    const affected = classes.filter((row) => {
      const referenceDate = [today, departure, dateOnly(row.semester.startDate)].toSorted().at(-1)!;
      return (
        dateOnly(row.semester.endDate) >= referenceDate &&
        assignedTeacherIdOn(row, new Date(referenceDate)) === profile.userId &&
        usualTeacherOn(row, new Date(referenceDate)) === null
      );
    });
    if (affected.length === 0) return [];
    return [
      linkItem({
        id: `teacher:${profile.userId}`,
        title: profile.user.name,
        detail: `${affected.length} ${affected.length === 1 ? "turma precisa" : "turmas precisam"} de professor`,
        href: `/turmas?professor=${profile.userId}&estado=ACTIVE`,
        date: departure,
        timing: { kind: "departure", date: departure },
      }),
    ];
  });
}

function coverageClasses(
  database: Prisma.TransactionClient,
  { teacherIds, horizon, today }: { teacherIds: string[]; horizon: string; today: string },
): Promise<Prisma.ClassGetPayload<{ select: typeof coverageSelect }>[]> {
  return database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: {
        deletedAt: null,
        startDate: { lte: new Date(horizon) },
        endDate: { gte: new Date(today) },
      },
      OR: [
        { teacherId: { in: teacherIds } },
        { teacherAssignments: { some: { teacherId: { in: teacherIds }, supersededAt: null } } },
      ],
    },
    select: coverageSelect,
  });
}
