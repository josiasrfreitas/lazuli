import { generatePortalClassName } from "@lazuli/domain";
import type { ClassPlan } from "./model";
import { compactSchedule } from "./shared";

export function reviewClassHeading(
  plan: Pick<ClassPlan, "scheduleType" | "stageName" | "stageCode" | "teacherName" | "slots">,
  name: string,
): { title: string; schedule?: string; description: string } {
  const schedule = compactSchedule(plan.slots, "long") || "Horário a definir";
  const teacher = plan.teacherName ?? "Professor a definir";
  const stage = plan.stageName ?? plan.stageCode ?? "Estágio a definir";
  const ppt = plan.scheduleType === "PERSONALIZED";
  const suffix = / · (\d+)$/u.exec(name);
  const sequence = Number(suffix?.[1] ?? 1);
  if (plan.slots.length) {
    const naming = {
      scheduleType: plan.scheduleType,
      stageInternalCode: plan.stageCode,
      slots: plan.slots,
    };
    const generated =
      name === generatePortalClassName({ ...naming, teacherName: plan.teacherName }, sequence) ||
      name === generatePortalClassName(naming, sequence);
    if (generated)
      return {
        title: `${ppt ? "PPT" : stage}${sequence > 1 ? ` · ${sequence}` : ""}`,
        schedule,
        description: ppt ? `${teacher} · Estágio por aluno` : teacher,
      };
  }
  const details = [ppt ? "PPT · estágio por aluno" : stage, schedule, teacher].filter(
    (fact) => !name.toLocaleLowerCase("pt-BR").includes(fact.toLocaleLowerCase("pt-BR")),
  );
  return { title: name, description: details.join(" · ") };
}
