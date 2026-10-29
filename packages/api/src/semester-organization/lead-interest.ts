import { z } from "@lazuli/validators";
import { badRequest, notFound } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { lockSemester, type OrganizationContext } from "./data.js";
import { linkPlanLeads } from "./write.js";

export const leadInterestSchema = z.object({
  leadId: z.string().uuid(),
  planId: z.string().uuid(),
});

export async function assignLeadInterest(
  context: OrganizationContext,
  input: z.infer<typeof leadInterestSchema>,
): Promise<void> {
  const initial = await context.database.semesterClassPlan.findFirst({
    where: { id: input.planId, deletedAt: null },
  });
  if (!initial) throw notFound("Turma não encontrada.");
  await lockSemester(context, initial.semesterId);
  const plan = await context.database.semesterClassPlan.findUniqueOrThrow({
    where: { id: initial.id },
    include: { class: true },
  });
  if (plan.closedAt || plan.class?.status === "ARCHIVED")
    throw badRequest("Escolha uma turma aberta.");
  await linkPlanLeads(context, { input: { ...plan, leadIds: [input.leadId] }, planId: plan.id });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.pendingLead",
    details: {
      subject: { type: "school", name: plan.name },
      description:
        "Interesse de lead vinculado à turma. A matrícula será concluída no período vigente.",
    },
  });
}
