import { addCalendarMonths } from "./monthly-contract.js";
import type { Weekday } from "./class-portal-name.js";

export function formationTeachingDay(slot: {
  weekday: Weekday;
  endTime: string;
}): Exclude<Weekday, "SUNDAY"> | null {
  if (slot.weekday === "SUNDAY" || (slot.weekday === "SATURDAY" && slot.endTime > "12:00"))
    return null;
  return slot.weekday;
}

const ISO_DATE_LENGTH = 10;
const MANUAL_CONFIRMATION_MONTHS = 3;

type ContractDates = { startsOn: string | null; endsOn: string | null };
export type FormationContractStatus = "MISSING" | "EARLY_END" | "COVERED";

/** Adjacent renewals cover one continuous interval. A gap still interrupts the membership. */
export function contractCoverageEnd(
  contracts: readonly ContractDates[],
  entryOn: string,
): string | null {
  let end: string | null = null;
  for (const contract of contracts.toSorted((left, right) =>
    (left.startsOn ?? "").localeCompare(right.startsOn ?? ""),
  )) {
    if (!contract.startsOn || !contract.endsOn || contract.endsOn < entryOn) continue;
    const nextDay = new Date((end ?? entryOn) + "T12:00:00Z");
    if (end) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    if (contract.startsOn > nextDay.toISOString().slice(0, ISO_DATE_LENGTH)) break;
    if (!end || contract.endsOn > end) end = contract.endsOn;
  }
  return end;
}

export function formationContractStatus(
  end: string | null,
  { from, through }: { from: string; through: string },
): FormationContractStatus {
  if (!end) return "MISSING";
  return end < through && end < addCalendarMonths(from, MANUAL_CONFIRMATION_MONTHS)
    ? "EARLY_END"
    : "COVERED";
}

export const MISSING_ENTRY_CONTRACT = "É necessário um contrato ativo na data de entrada.";

export function meetsFormationAverages(
  metrics:
    | { grades: string; attendance: number | null; attendanceFlagged: boolean }
    | null
    | undefined,
): boolean {
  return (
    metrics?.grades === "SUFFICIENT" && metrics.attendance !== null && !metrics.attendanceFlagged
  );
}
