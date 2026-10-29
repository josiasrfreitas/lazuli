"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { ArrowRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { NewStudentDialog } from "../new-student/new-student-dialog";
import { visibleActions } from "./student-pending-actions";

export function StudentChooseClass({ studentId }: { studentId: string }): ReactElement | null {
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
  const allocation =
    intentions.data &&
    visibleActions(pending.data?.items ?? [], 0, intentions.data).find(
      (item) => item.type === "CLASS_ALLOCATION",
    );
  const placement = pending.data?.items.find((item) => item.type === "PLACEMENT");
  const ready =
    Boolean(allocation) &&
    pending.isSuccess &&
    intentions.isSuccess &&
    occurrences.isSuccess &&
    interventions.isSuccess;
  useEffect(() => {
    if (requested !== "1" || !ready || consumed.current) return;
    const page = anchor.current?.closest("[data-ready]");
    if (!page) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      clearTimeout(timer);
      if (page.hasAttribute("data-entering")) return;
      // Let the resolved page paint before introducing the dialog backdrop.
      timer = setTimeout(() => {
        consumed.current = true;
        setOpen(true);
        void setRequested(null);
      }, 180);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(page, { attributes: true, attributeFilter: ["data-entering"] });
    schedule();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [requested, ready, setRequested]);
  if (placement?.action.type === "OPEN_LEAD")
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
      <Button onClick={() => setOpen(true)}>
        Definir primeira turma <ArrowRight aria-hidden="true" />
      </Button>
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
