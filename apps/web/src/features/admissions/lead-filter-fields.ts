import { Clock3, UsersRound } from "lucide-react";
import type { TableFilterField } from "@lazuli/ui";

const statuses = ["WAITING", "ENROLLED", "ARCHIVED"] as const;
const followUps = ["TODAY", "OVERDUE", "UNPLANNED"] as const;
export type LeadFilterParams = { situacao: string; retorno: string };

export function leadFilterInput(params: LeadFilterParams): {
  statuses: (typeof statuses)[number][];
  followUps: (typeof followUps)[number][];
} {
  return {
    statuses: statuses.filter((value) => params.situacao.split(",").includes(value)),
    followUps: followUps.filter((value) => params.retorno.split(",").includes(value)),
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
      label: "Situação",
      kind: "options",
      promoted: true,
      icon: UsersRound,
      options: [
        { id: "WAITING", label: "Em acompanhamento" },
        { id: "ENROLLED", label: "Matriculados" },
        { id: "ARCHIVED", label: "Arquivados" },
      ],
      selected: selected.statuses,
      onChange: (values) =>
        change({
          situacao: values.join(",") || "ALL",
          ...(values.length && !values.includes("WAITING") ? { retorno: "ALL" } : {}),
        }),
      onClear: () => change({ situacao: "ALL" }),
    },
    {
      id: "retorno",
      label: "Retornos",
      kind: "options",
      promoted: true,
      icon: Clock3,
      options: [
        { id: "TODAY", label: "Hoje" },
        { id: "OVERDUE", label: "Em atraso" },
        { id: "UNPLANNED", label: "Sem próximo passo" },
      ],
      selected: selected.followUps,
      onChange: (values) =>
        change({
          retorno: values.join(",") || "ALL",
          ...(values.length ? { situacao: "WAITING" } : {}),
        }),
      onClear: () => change({ retorno: "ALL" }),
    },
  ];
}
