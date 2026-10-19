import { availabilityCovers, type AvailabilityWindow } from "./admission-availability.js";

export type SemesterEligibility = {
  entryOn: string;
  studentActive: boolean;
  mode: "ENTRY" | "CONTINUE" | "ADVANCE" | "REPEAT";
  stage: { id: string; trackId: string; sequence: number } | null;
  source: {
    active: boolean;
    stageId: string;
    trackId: string;
    sequence: number;
    scheduleType: "REGULAR" | "PERSONALIZED";
    decision: string | null;
    confirmed: boolean;
  } | null;
  plan: {
    scheduleType: "REGULAR" | "PERSONALIZED";
    sharedStageId: string | null;
    format: string;
    slots: readonly AvailabilityWindow[];
    teacherReady: boolean;
    active: boolean;
  } | null;
  availability: {
    confirmed: boolean;
    validUntil: string;
    formats: readonly string[];
    slots: readonly AvailabilityWindow[];
  } | null;
};

/** The same eligibility contract applies at publication and before a scheduled entry takes effect. */
export function semesterPlacementBlockers(input: SemesterEligibility): string[] {
  const blockers: string[] = [];
  if (!input.studentActive) blockers.push("Cadastro do aluno não está ativo");
  if (!input.plan) blockers.push("Escolha uma turma planejada");
  else {
    if (!input.plan.teacherReady) blockers.push("Professor pendente na data de entrada");
    if (!input.plan.active) blockers.push("Turma de destino indisponível");
    if (input.plan.scheduleType === "REGULAR" && input.plan.sharedStageId !== input.stage?.id)
      blockers.push("Estágio diferente do estágio da turma regular");
  }
  if (!input.stage) blockers.push("Defina o estágio de destino");
  const availability = input.availability;
  if (!availability?.confirmed) blockers.push("Confirme a disponibilidade para este semestre");
  else {
    if (availability.validUntil < input.entryOn)
      blockers.push("Disponibilidade vence antes da entrada");
    if (input.plan && !availability.formats.includes(input.plan.format))
      blockers.push("Formato incompatível com a disponibilidade");
    if (input.plan && !availabilityCovers(availability.slots, input.plan.slots))
      blockers.push("Horários incompatíveis com a disponibilidade");
  }
  if (input.mode === "ENTRY") {
    if (input.source) blockers.push("Entrada nova não pode substituir um vínculo vigente");
    return blockers;
  }
  const source = input.source;
  if (!source?.active) {
    blockers.push("Percurso de origem mudou; revise a proposta");
    return blockers;
  }
  if (input.mode === "CONTINUE") {
    if (source.stageId !== input.stage?.id) blockers.push("Continuidade deve preservar o estágio");
  } else {
    const decision = input.mode === "ADVANCE" ? "APPROVED" : "REPEAT";
    if (!source.confirmed || source.decision !== decision)
      blockers.push(
        input.mode === "ADVANCE"
          ? "Aprovação pedagógica pendente"
          : "Confirmação de repetência pendente",
      );
    if (
      input.mode === "ADVANCE" &&
      (input.stage?.trackId !== source.trackId || input.stage.sequence !== source.sequence + 1)
    )
      blockers.push("Avanço exige o próximo estágio da mesma trilha");
    if (input.mode === "REPEAT" && source.stageId !== input.stage?.id)
      blockers.push("Repetência deve manter o estágio");
  }
  return blockers;
}
