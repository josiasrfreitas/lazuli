import type { RouterOutputs } from "@lazuli/api";
import type { BadgeVariant } from "@lazuli/ui";
export type Assessment = RouterOutputs["assessments"]["byProgress"];
export type Competence = Assessment["results"][number]["competence"];
export type Phase = Assessment["grades"][number]["phase"];
export const COMPETENCES: Competence[] = ["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"];
export const ASSESSMENT_ROW_ORDER: Competence[] = ["WRITTEN", "LISTENING", "ORAL", "PARTICIPATION"];
export const PHASES: Phase[] = ["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"];
export const COMPETENCE_LABELS: Record<Competence, string> = {
  ORAL: "Oral",
  LISTENING: "Listening",
  WRITTEN: "Written",
  PARTICIPATION: "Participação",
};
export const PHASE_LABELS: Record<Phase, string> = {
  BLOCK_ONE: "Unidade 1",
  BLOCK_TWO: "Unidade 2",
  RECOVERY: "Recuperação",
};
export const STATUS_LABELS = {
  INCOMPLETE: "Notas incompletas",
  SUFFICIENT: "Notas suficientes",
  NEEDS_SUPPORT: "Abaixo do corte",
};
export const COMPETENCE_VISUALS: Record<Competence, { color: string; badge: BadgeVariant }> = {
  ORAL: { color: "var(--info)", badge: "info" },
  LISTENING: { color: "var(--success)", badge: "success" },
  WRITTEN: { color: "var(--warning)", badge: "warning" },
  PARTICIPATION: { color: "var(--over-capacity)", badge: "over-capacity" },
};
export const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };
export const TOOLTIP = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--foreground)",
};
export const PASS = 60;
export const MAX = 100;
export const CHART_HEIGHT = 240;
export function gradeLabel(score: number | null): string {
  return score === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(score);
}
