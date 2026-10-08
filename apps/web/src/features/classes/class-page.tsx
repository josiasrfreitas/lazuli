"use client";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { ClassOverview, ClassContextSidebar } from "./class-overview";
import { MembershipDialog } from "./membership-dialog";
import { AssignmentDialog } from "../teachers/assignment-dialog";
import { RosterSection } from "./roster-section";

export function ClassPage({ id }: ClassPageInput): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  const detail = query.data;
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-6 overflow-y-auto p-4 lg:overflow-hidden">
      {query.isError && (
        <div role="alert" className="space-y-2">
          <p>
            {query.error.data?.code === "NOT_FOUND"
              ? "Turma não encontrada."
              : "Não foi possível carregar a turma."}
          </p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.isPending && <p role="status">Carregando turma…</p>}
      {detail && <ClassDetailView detail={detail} id={id} />}
    </div>
  );
}

function ClassDetailView({ detail, id }: ClassDetailViewInput): ReactElement {
  const [assigning, setAssigning] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <>
      <ClassOverview
        detail={detail}
        enroll={() => setMembershipOpen(true)}
        search={search}
        onSearchChange={setSearch}
      />
      <RosterSection
        key={`${id}/${search}`}
        classId={id}
        search={search}
        showStage={detail.scheduleType === "PERSONALIZED"}
        sidebar={<ClassContextSidebar detail={detail} onAssign={() => setAssigning(true)} />}
      />
      {assigning && (
        <AssignmentDialog
          classId={id}
          classCode={detail.internalCode}
          onClose={() => setAssigning(false)}
        />
      )}
      {membershipOpen && (
        <MembershipDialog
          mode="ENTRY"
          classId={id}
          scheduleType={detail.scheduleType}
          open
          onOpenChange={setMembershipOpen}
        />
      )}
    </>
  );
}

type ClassPageInput = { id: string };
type ClassDetailViewInput = {
  detail: RouterOutputs["classes"]["byId"];
  id: string;
};
