import { studentHealthLevel } from "@lazuli/domain";
import { metricNumber } from "./format";

const bands = {
  HEALTHY: { color: "text-success", label: "Saudável" },
  ATTENTION: { color: "text-warning", label: "Requer atenção" },
  PRIORITY: { color: "text-destructive", label: "Acompanhamento prioritário" },
  INSUFFICIENT_DATA: { color: "text-muted-foreground", label: "Sem dados" },
};

export function HealthScoreValue({ value }: { value: number | null | undefined }) {
  const band = bands[studentHealthLevel(value ?? null)];
  return (
    <span className={band.color} title={band.label}>
      {metricNumber(value)}
      <span className="sr-only"> · {band.label}</span>
    </span>
  );
}
