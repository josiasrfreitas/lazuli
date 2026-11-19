import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import type { ClassPlan } from "./model";
import { formationDetailParsers, restoreReviewFormationLocation } from "./review-navigation";

export type PanelPerson = { kind: "student" | "lead"; id: string };
type PanelView = {
  planId: string | null;
  person: PanelPerson | null;
};
type ReturnPoint = PanelView & {
  trigger: string | null;
  panelScroll: number;
  weekScroll: number;
};
const scheduleStart: ReturnPoint = {
  person: null,
  planId: null,
  trigger: null,
  panelScroll: 0,
  weekScroll: 0,
};

export type FormationNavigation = {
  returnView: PanelView | undefined;
  returnToReview: boolean;
  returnHref: string;
  panel: PanelPerson | null;
  workspace: RefObject<HTMLDivElement | null>;
  goBack: () => void;
  reset: () => void;
  selectPerson: (person: PanelPerson, origin: HTMLElement) => void;
  showPlan: (plan: ClassPlan, origin: HTMLElement) => void;
};

function captureReturnPoint(view: PanelView, origin: HTMLElement): ReturnPoint {
  const root = origin.closest("[data-formation-workspace]");
  return {
    ...view,
    trigger: origin.dataset.formationFocus ?? null,
    panelScroll: root?.querySelector("[data-formation-scroll]")?.scrollTop ?? 0,
    weekScroll: root?.querySelector("[data-formation-week]")?.scrollTop ?? 0,
  };
}

function focusReturnPoint(root: HTMLElement, target: ReturnPoint | "heading"): void {
  const heading = root.querySelector<HTMLElement>("#formation-panel-heading");
  if (target === "heading") {
    heading?.focus({ preventScroll: true });
    return;
  }
  const list = root.querySelector<HTMLElement>("[data-formation-scroll]");
  if (list) list.scrollTop = target.panelScroll;
  const week = root.querySelector<HTMLElement>("[data-formation-week]");
  if (week) week.scrollTop = target.weekScroll;
  const trigger =
    target.trigger &&
    root.querySelector<HTMLElement>(`[data-formation-focus="${CSS.escape(target.trigger)}"]`);
  const fallback = heading ?? document.querySelector<HTMLElement>("#formation-page-heading");
  (trigger || fallback)?.focus({ preventScroll: true });
}

function usePanelFocus(
  workspace: RefObject<HTMLDivElement | null>,
  { person: panel, planId }: PanelView,
): RefObject<"heading" | ReturnPoint | null> {
  const pendingFocus = useRef<"heading" | ReturnPoint | null>(panel || planId ? "heading" : null);
  const viewingStudent = panel?.kind === "student" && !planId;
  const wasViewingStudent = useRef(false);

  useLayoutEffect(() => {
    const root = workspace.current;
    const target = pendingFocus.current;
    const changedStudentView = viewingStudent !== wasViewingStudent.current;
    wasViewingStudent.current = viewingStudent;
    if (!root || !target) return;
    pendingFocus.current = null;
    focusReturnPoint(root, target);
    const surface = root.querySelector<HTMLElement>("#formation-panel");
    if (
      surface &&
      changedStudentView &&
      !Object.hasOwn(document.documentElement.dataset, "formationPanel")
    ) {
      surface.dataset.studentArrival = viewingStudent ? "forward" : "backward";
      return () => {
        delete surface.dataset.studentArrival;
      };
    }
  }, [panel, planId, viewingStudent]);
  return pendingFocus;
}

function usePanelLocation(previous: PanelView | undefined): Pick<
  FormationNavigation,
  "panel" | "returnToReview" | "returnHref"
> & {
  setPanel: (person: PanelPerson | null) => void;
  goToReview: () => void;
} {
  const [route, setRoute] = useQueryStates(formationDetailParsers);
  const panel = useMemo<PanelPerson | null>(() => {
    if (route.leadFormacao) return { kind: "lead", id: route.leadFormacao };
    if (route.alunoFormacao) return { kind: "student", id: route.alunoFormacao };
    return null;
  }, [route.leadFormacao, route.alunoFormacao]);
  function setPanel(person: PanelPerson | null): void {
    void setRoute({
      alunoFormacao: person?.kind === "student" ? person.id : null,
      leadFormacao: person?.kind === "lead" ? person.id : null,
    });
  }
  const returnToReview = !previous && route.retornoFormacao === "review";
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams());
  if (returnToReview) {
    restoreReviewFormationLocation(params);
  } else {
    params.delete("turma");
    params.delete("alunoFormacao");
    params.delete("leadFormacao");
    if (previous?.planId) params.set("turma", previous.planId);
    if (previous?.person) {
      params.set(
        previous.person.kind === "lead" ? "leadFormacao" : "alunoFormacao",
        previous.person.id,
      );
    }
  }
  const returnHref = params.size > 0 ? pathname + "?" + params.toString() : pathname;
  function goToReview(): void {
    void setRoute({
      visao: "review",
      turma: params.get("turma"),
      alunoFormacao: params.get("alunoFormacao"),
      leadFormacao: params.get("leadFormacao"),
      retornoFormacao: null,
      origemGradeFormacao: null,
    });
  }
  return { panel, setPanel, returnToReview, returnHref, goToReview };
}

export function useFormationNavigation(
  planId: string | null,
  setPlan: (id: string | null) => void,
): FormationNavigation {
  const [history, setHistory] = useState<ReturnPoint[]>([]);
  const returnView = history.at(-1);
  const { panel, setPanel, returnHref, returnToReview, goToReview } = usePanelLocation(returnView);
  const workspace = useRef<HTMLDivElement>(null);
  const pendingFocus = usePanelFocus(workspace, { person: panel, planId });
  const transition = useSectionCarousel({ order: ["previous", "next"], scope: "formationPanel" });

  function open(view: PanelView, origin: HTMLElement): void {
    const point = captureReturnPoint({ person: panel, planId }, origin);
    const replacingPlan = Boolean(planId && view.planId);
    transition(replacingPlan ? "next" : "previous", {
      next: "next",
      update: () => {
        if (!replacingPlan) setHistory((previous) => [...previous, point]);
        pendingFocus.current = "heading";
        setPanel(view.person);
        setPlan(view.planId);
        if (view.planId && view.planId === planId) {
          pendingFocus.current = null;
          if (workspace.current) focusReturnPoint(workspace.current, "heading");
        }
      },
    });
  }
  function goBack(): void {
    if (returnToReview) {
      goToReview();
      return;
    }
    transition("next", {
      next: "previous",
      update: () => {
        const point = history.at(-1) ?? scheduleStart;
        setHistory((previous) => previous.slice(0, -1));
        pendingFocus.current = point;
        setPanel(point.person);
        setPlan(point.planId);
      },
    });
  }
  function reset(): void {
    setHistory([]);
    pendingFocus.current = null;
    setPanel(null);
    setPlan(null);
  }
  return {
    returnView,
    returnHref,
    returnToReview,
    panel,
    workspace,
    goBack,
    reset,
    selectPerson: (person: PanelPerson, origin: HTMLElement) =>
      open({ person, planId: null }, origin),
    showPlan: (plan: ClassPlan, origin: HTMLElement) =>
      open({ person: panel, planId: plan.id }, origin),
  };
}
