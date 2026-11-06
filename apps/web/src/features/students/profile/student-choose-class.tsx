"use client";

import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { ArrowRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { NewStudentDialog } from "../new-student/new-student-dialog";
import { visibleActions } from "./student-pending-actions";

const DIALOG_OPEN_DELAY_MS = 180;

export function StudentChooseClass({
  studentId,
  showButton = true,
}: {
  studentId: string;
  showButton?: boolean;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useQueryState("definirTurma");
  const anchor = useRef<HTMLDivElement>(null);
  const consumed = useRef(false);
  const historyInput = { studentId, search: "", page: 1 };
  const occurrences = trpc.occurrences.list.useQuery(historyInput, { enabled: requested === "1" });
  const interventions = trpc.interventions.list.useQuery(historyInput, {
    enabled: requested === "1",
  });
  const pending = trpc.students.pendingActions.useQuery({ id: studentId });
  const intentions = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  const allocation = classAllocation(pending.data?.items, intentions.data);
  const placement = pending.data?.items.find((item) => item.type === "PLACEMENT");
  const ready = [
    allocation,
    pending.isSuccess,
    intentions.isSuccess,
    occurrences.isSuccess,
    interventions.isSuccess,
  ].every(Boolean);
  useRequestedClassDialog({ requested, ready, setRequested, setOpen, anchor, consumed });
  if (placement?.action.type === "OPEN_LEAD" && (showButton || requested === "1"))
    return (
      <Button
        nativeButton={false}
        render={<Link href={`/interessados/${placement.action.resourceId}`} />}
      >
        {placement.action.label} <ArrowRight aria-hidden="true" />
      </Button>
    );
  if (!allocation) return null;
  return (
    <div ref={anchor}>
      {showButton && (
        <Button onClick={() => setOpen(true)}>
          Definir primeira turma <ArrowRight aria-hidden="true" />
        </Button>
      )}
      <NewStudentDialog
        open={open}
        initialStep="pedagogy"
        existingStudentId={studentId}
        onOpenChange={setOpen}
        onCreated={() => setOpen(false)}
      />
    </div>
  );
}

function classAllocation(
  items: Parameters<typeof visibleActions>[0] | undefined,
  intentions: Parameters<typeof visibleActions>[2] | undefined,
): ReturnType<typeof visibleActions>[number] | undefined {
  if (!intentions) return undefined;
  return visibleActions(items ?? [], 0, intentions).find(
    (item) => item.type === "CLASS_ALLOCATION",
  );
}

function useRequestedClassDialog({
  requested,
  ready,
  setRequested,
  setOpen,
  anchor,
  consumed,
}: {
  requested: string | null;
  ready: boolean;
  setRequested: ReturnType<typeof useQueryState>[1];
  setOpen: (value: boolean) => void;
  anchor: RefObject<HTMLDivElement | null>;
  consumed: RefObject<boolean>;
}): void {
  useEffect(() => {
    if (requested !== "1" || !ready || consumed.current) return;
    const page = anchor.current?.closest<HTMLElement>("[data-ready]");
    if (!page) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      clearTimeout(timer);
      if (Object.hasOwn(page.dataset, "entering")) return;
      // Let the resolved page paint before introducing the dialog backdrop.
      timer = setTimeout(() => {
        consumed.current = true;
        setOpen(true);
        void setRequested(null);
      }, DIALOG_OPEN_DELAY_MS);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(page, { attributes: true, attributeFilter: ["data-entering"] });
    schedule();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [requested, ready, setRequested]);
}
