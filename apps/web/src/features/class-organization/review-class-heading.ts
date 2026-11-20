import { generatePortalClassName } from "@lazuli/domain";
import type { ClassPlan } from "./model";
import { compactSchedule } from "./shared";

type HeadingPlan = Pick<
  ClassPlan,
  "scheduleType" | "stageName" | "stageCode" | "teacherName" | "slots"
>;

function generatedSequence(plan: HeadingPlan, name: string): number | null {
  if (plan.slots.length === 0) return null;
  const sequence = Number(/ · (\d+)$/u.exec(name)?.[1] ?? 1);
  const naming = {
    scheduleType: plan.scheduleType,
    stageInternalCode: plan.stageCode,
    slots: plan.slots,
  };
  return name === generatePortalClassName({ ...naming, teacherName: plan.teacherName }, sequence) ||
    name === generatePortalClassName(naming, sequence)
    ? sequence
    : null;
}

export function reviewClassHeading(
  plan: HeadingPlan,
  name: string,
): { title: string; schedule?: string; description: string } {
  const schedule = compactSchedule(plan.slots, "long") || "Horário a definir";
  const teacher = plan.teacherName ?? "Docente a definir";
  const stage = plan.stageName ?? plan.stageCode ?? "Estágio a definir";
  const ppt = plan.scheduleType === "PERSONALIZED";
  const sequence = generatedSequence(plan, name);
  if (sequence !== null)
    return {
      title: `${ppt ? "PPT" : stage}${sequence > 1 ? ` · ${sequence}` : ""}`,
      schedule,
      description: ppt ? `${teacher} · Estágio por aluno` : teacher,
    };
  const details = [ppt ? "PPT · estágio por aluno" : stage, schedule, teacher].filter(
    (fact) => !name.toLocaleLowerCase("pt-BR").includes(fact.toLocaleLowerCase("pt-BR")),
  );
  return { title: name, description: details.join(" · ") };
}
