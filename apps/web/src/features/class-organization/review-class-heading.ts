import type { ClassPlan } from "./model";
import { compactSchedule } from "./shared";

type HeadingPlan = Pick<
  ClassPlan,
  "scheduleType" | "stageName" | "stageCode" | "teacherName" | "slots"
>;

export function reviewClassHeading(
  plan: HeadingPlan,
  name: string,
): { title: string; schedule?: string; description: string } {
  const schedule = compactSchedule(plan.slots, "long") || "Horário a definir";
  const teacher = plan.teacherName ?? "Docente a definir";
  const stage = plan.stageName ?? plan.stageCode ?? "Estágio a definir";
  const ppt = plan.scheduleType === "PERSONALIZED";
  const suffix = / · \d+$/u.exec(name)?.[0] ?? "";
  return {
    title: (ppt ? "PPT" : stage) + suffix,
    schedule,
    description: ppt ? `${teacher} · Estágio por aluno` : teacher,
  };
}
