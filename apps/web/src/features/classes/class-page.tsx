"use client";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import { Button, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { ClassOverview, ClassContext } from "./class-overview";
import { MembershipDialog } from "./membership-dialog";
import { AssignmentDialog } from "../teachers/assignment-dialog";
import { ClassPerformance } from "~/features/assessments/class-performance";
import { RosterSection } from "./roster-section";
import { GenerationNotice } from "../class-records/generation-notice";

export function ClassPage({ id }: ClassPageInput): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  const detail = query.data;
  return (
    <div className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-7xl flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
      <ClassOverview detail={detail} enroll={() => setMembershipOpen(true)} />
      <ClassContext detail={detail} onAssign={() => setAssigning(true)} />
      <GenerationNotice classId={id} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold">Rotina pedagógica</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            {detail.scheduleType === "REGULAR"
              ? "Cronograma compartilhado, atividades e prazo do semestre."
              : "Roteiro e prazo individual para cada aluno do PPT."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/planejamento?turma=${id}`} />}
          >
            Planejamento
          </Button>
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/aulas?turma=${id}`} />}
          >
            Aulas da turma
          </Button>
        </div>
      </div>
      <ClassPerformance classId={id} />
      <RosterHeading search={search} onSearchChange={setSearch} />
      <RosterSection
        key={`${id}/${search}`}
        classId={id}
        search={search}
        showStage={detail.scheduleType === "PERSONALIZED"}
      />
      {assigning && (
        <AssignmentDialog
          classId={id}
          classCode={detail.portalClassName}
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

function RosterHeading({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Alunos da turma</h2>
      <div className="w-full sm:w-64">
        <Input
          aria-label="Buscar aluno na turma"
          placeholder="Buscar aluno"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}
