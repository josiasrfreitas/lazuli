import { Gauge, UsersRound } from "lucide-react";
import type { TableFilterField } from "@lazuli/ui";
import { leadInterestLabels, statusLabels } from "./labels";

const statuses = ["WAITING", "ENROLLED", "ARCHIVED"] as const;
const interests = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"] as const;
export type LeadFilterParams = { situacao: string; interesse: string };

export function leadFilterInput(params: LeadFilterParams): {
  statuses: ("ARCHIVED" | "WAITING" | "ENROLLED")[];
  interests: ("UNKNOWN" | "LOW" | "MEDIUM" | "HIGH")[];
} {
  return {
    statuses: statuses.filter((value) => params.situacao.split(",").includes(value)),
    interests: interests.filter((value) => params.interesse.split(",").includes(value)),
  };
}
export function leadFilterFields(
  params: LeadFilterParams,
  change: (value: Partial<LeadFilterParams>) => void,
): TableFilterField[] {
  const selected = leadFilterInput(params);
  return [
    {
      id: "situacao",
      label: "Status",
      kind: "options",
      promoted: true,
      icon: UsersRound,
      options: statuses.map((id) => ({ id, label: statusLabels[id] })),
      selected: selected.statuses,
      onChange: (values) => change({ situacao: values.join(",") || "ALL" }),
      onClear: () => change({ situacao: "ALL" }),
    },
    {
      id: "interesse",
      label: "Interesse",
      kind: "options",
      promoted: true,
      icon: Gauge,
      options: interests.map((id) => ({ id, label: leadInterestLabels[id] })),
      selected: selected.interests,
      onChange: (values) => change({ interesse: values.join(",") || "ALL" }),
      onClear: () => change({ interesse: "ALL" }),
    },
  ];
}
