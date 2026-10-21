/** Derived work to resolve. IDs remain stable so different screens can show the same item. */
export type PendingAction = {
  id: string;
  type: "PLACEMENT" | "CLASS_ALLOCATION" | "CONTRACT";
  subject: { type: "STUDENT"; id: string; name: string };
  title: string;
  description: string;
  action: {
    type: "OPEN_LEAD" | "ALLOCATE_STUDENT" | "CREATE_CONTRACT";
    label: string;
    resourceId: string;
  };
  blockedBy: string[];
};

export function studentPendingActions(input: {
  id: string;
  name: string;
  active: boolean;
  hasEnrollment: boolean;
  hasContract: boolean;
  placement: { leadId: string; completed: boolean } | null;
}): PendingAction[] {
  if (!input.active) return [];
  const subject = { type: "STUDENT" as const, id: input.id, name: input.name };
  const items: PendingAction[] = [];
  const placementId = `${input.id}:placement`;
  const needsPlacement = Boolean(
    !input.hasEnrollment && input.placement && !input.placement.completed,
  );
  if (needsPlacement)
    items.push({
      id: placementId,
      type: "PLACEMENT",
      subject,
      title: "Concluir nivelamento",
      description: "A prova e o resultado definem o estágio para escolher a turma.",
      action: {
        type: "OPEN_LEAD",
        label: "Abrir nivelamento",
        resourceId: input.placement!.leadId,
      },
      blockedBy: [],
    });
  if (!input.hasEnrollment)
    items.push({
      id: `${input.id}:class`,
      type: "CLASS_ALLOCATION",
      subject,
      title: "Definir turma",
      description: needsPlacement
        ? "A escolha da turma aguarda o resultado do nivelamento."
        : "O aluno está cadastrado e aguarda alocação em uma turma.",
      action: { type: "ALLOCATE_STUDENT", label: "Escolher turma", resourceId: input.id },
      blockedBy: needsPlacement ? [placementId] : [],
    });
  if (!input.hasContract)
    items.push({
      id: `${input.id}:contract`,
      type: "CONTRACT",
      subject,
      title: "Criar contrato",
      description: "O contrato pode ser acertado mesmo antes da definição da turma.",
      action: { type: "CREATE_CONTRACT", label: "Criar contrato", resourceId: input.id },
      blockedBy: [],
    });
  return items;
}
