export type SemesterEligibility = {
  semesterId: string;
  entryOn: string;
  studentActive: boolean;
  mode: "ENTRY" | "CONTINUE" | "ADVANCE" | "REPEAT";
  stage: { id: string; trackId: string; sequence: number } | null;
  source: {
    semesterId: string;
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
    teacherReady: boolean;
    active: boolean;
  } | null;
};

/** The same eligibility contract applies at publication and before a scheduled entry takes effect. */
export function semesterPlacementBlockers(input: SemesterEligibility): string[] {
  return [
    ...(input.studentActive ? [] : ["Cadastro do aluno não está ativo"]),
    ...planBlockers(input),
    ...(input.stage ? [] : ["Defina o estágio de destino"]),
    ...progressionBlockers(input),
  ];
}

function planBlockers(input: SemesterEligibility): string[] {
  const plan = input.plan;
  if (!plan) return ["Escolha uma turma planejada"];
  const blockers: string[] = [];
  if (!plan.teacherReady) blockers.push("Professor pendente na data de entrada");
  if (!plan.active) blockers.push("Turma de destino indisponível");
  if (plan.scheduleType === "REGULAR" && plan.sharedStageId !== input.stage?.id)
    blockers.push("Estágio diferente do estágio da turma regular");
  return blockers;
}

function progressionBlockers(input: SemesterEligibility): string[] {
  if (input.mode === "ENTRY")
    return input.source ? ["Entrada nova não pode substituir um vínculo vigente"] : [];
  const source = input.source;
  if (!source?.active) return ["Percurso de origem mudou; revise a proposta"];
  if (input.mode === "CONTINUE") return continuationBlockers(input, source);
  return academicDecisionBlockers(input, source);
}

type Source = NonNullable<SemesterEligibility["source"]>;

function continuationBlockers(input: SemesterEligibility, source: Source): string[] {
  const blockers: string[] = [];
  if (source.stageId !== input.stage?.id) blockers.push("Continuidade deve preservar o estágio");
  if (
    source.semesterId !== input.semesterId &&
    (source.scheduleType !== "PERSONALIZED" || input.plan?.scheduleType !== "PERSONALIZED")
  )
    blockers.push("Continuidade no mesmo estágio exige origem e destino PPT");
  return blockers;
}

function academicDecisionBlockers(input: SemesterEligibility, source: Source): string[] {
  const blockers: string[] = [];
  const advancing = input.mode === "ADVANCE";
  const decision = advancing ? "APPROVED" : "REPEAT";
  if (!source.confirmed || source.decision !== decision)
    blockers.push(
      advancing ? "Aprovação pedagógica pendente" : "Confirmação de repetência pendente",
    );
  if (advancing && !isNextStage(input.stage, source))
    blockers.push("Avanço exige o próximo estágio da mesma trilha");
  if (input.mode === "REPEAT" && source.stageId !== input.stage?.id)
    blockers.push("Repetência deve manter o estágio");
  return blockers;
}

function isNextStage(stage: SemesterEligibility["stage"], source: Source): boolean {
  return stage?.trackId === source.trackId && stage.sequence === source.sequence + 1;
}
