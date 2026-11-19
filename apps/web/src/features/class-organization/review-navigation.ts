"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { reviewParsers } from "./review-filters";

export const formationDetailParsers = {
  visao: parseAsString,
  turma: parseAsString,
  alunoFormacao: parseAsString,
  leadFormacao: parseAsString,
  retornoFormacao: parseAsString,
  origemGradeFormacao: parseAsString,
};

const panelKeys = ["turma", "alunoFormacao", "leadFormacao"] as const;

function copyPanel(target: URLSearchParams, source: Pick<URLSearchParams, "get">): void {
  for (const key of panelKeys) {
    const value = source.get(key);
    if (value) target.set(key, value);
    else target.delete(key);
  }
}

export function restoreReviewFormationLocation(params: URLSearchParams): void {
  copyPanel(params, new URLSearchParams(params.get("origemGradeFormacao") ?? ""));
  params.delete("origemGradeFormacao");
  params.delete("retornoFormacao");
  params.set("visao", "review");
}

export function reviewStudentHref(
  path: string,
  current: Pick<URLSearchParams, "toString" | "get">,
  rowId: string,
  groupId: string,
): string {
  const params = new URLSearchParams(current.toString());
  const origin = new URLSearchParams();
  copyPanel(origin, current);
  params.delete("visao");
  params.delete("turma");
  params.delete("leadFormacao");
  params.set("alunoFormacao", rowId);
  params.set("retornoFormacao", "review");
  if (origin.size) params.set("origemGradeFormacao", origin.toString());
  else params.delete("origemGradeFormacao");
  params.set("grupoVinculo", groupId);
  params.set("vinculo", rowId);
  return path + "?" + params.toString();
}

export function useReviewStudentHref(
  semesterId: string,
): (rowId: string, groupId: string) => string {
  const path = usePathname();
  const params = new URLSearchParams(useSearchParams());
  params.set("semestre", semesterId);
  return (rowId, groupId) => reviewStudentHref(path, params, rowId, groupId);
}

export function useOpenReviewFormationDetail() {
  const current = useSearchParams();
  const [, setRoute] = useQueryStates(formationDetailParsers, { history: "push" });
  function open(planId: string | null, leadId: string | null): void {
    const origin = new URLSearchParams();
    copyPanel(origin, current);
    void setRoute({
      visao: null,
      turma: planId,
      alunoFormacao: null,
      leadFormacao: leadId,
      retornoFormacao: "review",
      origemGradeFormacao: origin.size ? origin.toString() : null,
    });
  }
  return {
    openPlan: (id: string) => open(id, null),
    openLead: (id: string) => open(null, id),
  };
}

export function useFormationReviewHref(semesterId: string, planId?: string): string {
  const path = usePathname();
  const current = useSearchParams();
  const params = new URLSearchParams(current);
  params.set("semestre", semesterId);
  if (params.get("retornoFormacao") === "review") {
    restoreReviewFormationLocation(params);
    if (planId && params.get("grupoVinculo") !== planId) {
      params.set("grupoVinculo", planId);
      params.delete("vinculo");
    }
    return path + "?" + params.toString();
  }
  for (const filter of Object.keys(reviewParsers)) params.delete(filter);
  params.delete("vinculo");
  params.delete("grupoVinculo");
  params.delete("retornoFormacao");
  params.delete("origemGradeFormacao");
  params.set("visao", "review");
  params.set("vinculos", "all");
  if (planId) params.set("grupoVinculo", planId);
  return path + "?" + params.toString();
}
