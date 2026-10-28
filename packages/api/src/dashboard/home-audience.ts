import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context } from "../trpc/context.js";

type AgeGroup = { id: string; label: string; count: number };
const DATE_ONLY_LENGTH = 10;
const YEAR_LENGTH = 4;
const MONTH_DAY_START = 5;
const AGE_BANDS = [
  { id: "children", label: "Crianças", maximum: 11 },
  { id: "teens", label: "Adolescentes", maximum: 17 },
  { id: "adults", label: "Adultos", maximum: Infinity },
];

export async function readStudentAges(
  database: Context["db"],
  now: Date,
): Promise<{ total: number; groups: AgeGroup[] }> {
  const today = saoPauloDateOnly(now);
  const rows = await database.student.groupBy({
    by: ["birthDate"],
    where: { deletedAt: null, status: "ACTIVE" },
    _count: { _all: true },
  });
  const groups = [
    ...AGE_BANDS.map(({ id, label }) => ({ id, label, count: 0 })),
    { id: "unknown", label: "Não informada", count: 0 },
  ];
  let total = 0;
  for (const row of rows) {
    const birth = row.birthDate?.toISOString().slice(0, DATE_ONLY_LENGTH);
    const age =
      birth && birth <= today
        ? Number(today.slice(0, YEAR_LENGTH)) -
          Number(birth.slice(0, YEAR_LENGTH)) -
          Number(today.slice(MONTH_DAY_START) < birth.slice(MONTH_DAY_START))
        : null;
    const id = age === null ? "unknown" : AGE_BANDS.find((band) => age <= band.maximum)!.id;
    groups.find((group) => group.id === id)!.count += row._count._all;
    total += row._count._all;
  }
  return { total, groups };
}

/** Cohort conversion: leads created in the selected month that now have a student link. */
export async function readLeadConversion(
  database: Context["db"],
  { month, through }: { month: string; through: string },
): Promise<{ month: string; leads: number; converted: number }> {
  const rows = await database.admissionCandidate.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        gte: new Date(`${month}-01T00:00:00-03:00`),
        lte: new Date(`${through}T23:59:59.999-03:00`),
      },
    },
    select: { student: { select: { deletedAt: true } } },
  });
  return {
    month,
    leads: rows.length,
    converted: rows.filter((row) => row.student !== null && row.student.deletedAt === null).length,
  };
}
