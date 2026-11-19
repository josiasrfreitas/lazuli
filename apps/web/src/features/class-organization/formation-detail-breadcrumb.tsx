"use client";
import { useLayoutEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { ReturnBreadcrumb } from "~/components/app-shell/app-breadcrumb";
import type { ClassPlan } from "./model";

export function formationPlanTitle(plan: ClassPlan): string {
  if (plan.scheduleType === "PERSONALIZED") return plan.name;
  return plan.stageName ?? plan.stageCode ?? plan.name;
}

export function FormationDetailBreadcrumb({
  name,
  parent,
  onBack,
}: {
  name: string;
  parent?: { label: string; planId: string | null; agenda?: boolean; href?: string } | undefined;
  onBack: () => void;
}): ReactElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  useLayoutEffect(() => {
    setTarget(document.getElementById("formation-detail-breadcrumb"));
  }, []);
  if (!target) return null;
  const params = new URLSearchParams(search.toString());
  params.delete("vinculo");
  if (parent?.agenda) params.delete("visao");
  if (parent?.planId) params.set("turma", parent.planId);
  else params.delete("turma");
  const query = params.toString();
  return createPortal(
    <ReturnBreadcrumb
      page={name}
      parent={{
        label: parent?.label ?? "Formação de turmas",
        href: parent?.href ?? (query ? `${pathname}?${query}` : pathname),
      }}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onBack();
      }}
    />,
    target,
  );
}
