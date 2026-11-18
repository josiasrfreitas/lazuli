import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import type { ClassPlan } from "./model";

export type PanelPerson = { kind: "student" | "lead"; id: string };
type PanelView = {
  planId: string | null;
  person: PanelPerson | null;
};
type ReturnPoint = PanelView & {
  mobile: string;
  trigger: string | null;
  panelScroll: number;
  weekScroll: number;
};
const queueStart: ReturnPoint = {
  person: null,
  planId: null,
  mobile: "painel",
  trigger: null,
  panelScroll: 0,
  weekScroll: 0,
};

export type FormationNavigation = {
  panel: PanelPerson | null;
  mobile: string;
  setMobile: (value: string) => void;
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
    mobile: origin.closest("#formation-panel") ? "painel" : "grade",
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
  (trigger || heading)?.focus({ preventScroll: true });
}

export function useFormationNavigation(
  planId: string | null,
  setPlan: (id: string | null) => void,
): FormationNavigation {
  const [panel, setPanel] = useState<PanelPerson | null>(null);
  const [mobile, setMobile] = useState(planId ? "painel" : "grade");
  const workspace = useRef<HTMLDivElement>(null);
  const history = useRef<ReturnPoint[]>([]);
  const pendingFocus = useRef<"heading" | ReturnPoint | null>(null);
  const transition = useSectionCarousel({ order: ["previous", "next"], scope: "formationPanel" });

  useLayoutEffect(() => {
    const root = workspace.current;
    const target = pendingFocus.current;
    if (!root || !target) return;
    pendingFocus.current = null;
    focusReturnPoint(root, target);
  }, [mobile, panel, planId]);

  function open(view: PanelView, origin: HTMLElement): void {
    const point = captureReturnPoint({ person: panel, planId }, origin);
    const replacingPlan = Boolean(planId && view.planId);
    transition(replacingPlan ? "next" : "previous", {
      next: "next",
      update: () => {
        if (!replacingPlan) history.current.push(point);
        pendingFocus.current = "heading";
        setMobile("painel");
        setPanel(view.person);
        setPlan(view.planId);
        if (view.planId && view.planId === planId && mobile === "painel") {
          pendingFocus.current = null;
          if (workspace.current) focusReturnPoint(workspace.current, "heading");
        }
      },
    });
  }
  function goBack(): void {
    transition("next", {
      next: "previous",
      update: () => {
        const point = history.current.pop() ?? queueStart;
        pendingFocus.current = point;
        setPanel(point.person);
        setPlan(point.planId);
        setMobile(point.mobile);
      },
    });
  }
  function reset(): void {
    history.current = [];
    pendingFocus.current = null;
    setPanel(null);
    setPlan(null);
  }
  return {
    panel,
    mobile,
    setMobile,
    workspace,
    goBack,
    reset,
    selectPerson: (person: PanelPerson, origin: HTMLElement) =>
      open({ person, planId: null }, origin),
    showPlan: (plan: ClassPlan, origin: HTMLElement) =>
      open({ person: panel, planId: plan.id }, origin),
  };
}
