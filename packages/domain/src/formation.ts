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
  const midpoint = (Date.parse(from) + Date.parse(through)) / 2;
  return Date.parse(end) <= midpoint ? "EARLY_END" : "COVERED";
}

export const MISSING_ENTRY_CONTRACT = "É necessário um contrato ativo na data de entrada.";

export function hasFormationSignal(row: {
  continuity: string;
  exitRiskActive: boolean;
  attentionNote: string | null;
  classClosurePending: boolean;
}): boolean {
  return Boolean(
    row.exitRiskActive ||
    row.attentionNote?.trim() ||
    row.classClosurePending ||
    row.continuity === "LEAVING" ||
    row.continuity === "CHANGE",
  );
}

export const formationBlocker = {
  classClosed: "Turma encerrada",
  missingContract: "Sem contrato vigente",
  earlyContractEnd: "Contrato termina na primeira metade do período",
  material: "Material sem compra registrada",
  lowGrade: "Notas insuficientes",
  lowAttendance: "Frequência baixa",
  staff: "Impedimento sinalizado pela equipe",
  leaving: "Risco de saída",
  change: "Escolha a nova turma para continuar.",
} as const;

type FormationBlockerInput = {
  continuing: boolean;
  continuity: string;
  contractStatus: FormationContractStatus;
  materialMissing: boolean;
  grades: string | undefined;
  attendanceFlagged: boolean;
  staffImpediment: boolean;
  exitRiskActive?: boolean;
  classClosurePending?: boolean;
};

function continuationBlockers(input: FormationBlockerInput): string[] {
  const reasons: string[] = [];
  if (input.classClosurePending) reasons.push(formationBlocker.classClosed);
  if (input.contractStatus === "EARLY_END") reasons.push(formationBlocker.earlyContractEnd);
  if (input.materialMissing) reasons.push(formationBlocker.material);
  if (input.grades === "NEEDS_SUPPORT") reasons.push(formationBlocker.lowGrade);
  if (input.attendanceFlagged) reasons.push(formationBlocker.lowAttendance);
  return reasons;
}

export function formationPlacementBlockers(input: FormationBlockerInput): string[] {
  const reasons: string[] = [];
  if (input.classClosurePending) reasons.push(formationBlocker.classClosed);
  if (input.contractStatus === "MISSING") reasons.push(formationBlocker.missingContract);
  if (input.staffImpediment) reasons.push(formationBlocker.staff);
  if (input.exitRiskActive || input.continuity === "LEAVING")
    reasons.push(formationBlocker.leaving);
  if (input.continuity === "CHANGE") reasons.push(formationBlocker.change);
  if (input.continuing) reasons.push(...continuationBlockers(input));
  return reasons;
}
