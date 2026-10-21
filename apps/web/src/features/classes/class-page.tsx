"use client";
import { PlanningPage } from "../stage-planning/planning-page";
import { useState, type ReactElement } from "react";
import { CalendarDays, UsersRound, UserRoundPlus } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Button, InlineSkeleton, Input, Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { ClassOverview } from "./class-overview";
import { MembershipDialog } from "./membership-dialog";
import { AssignmentDialog } from "../teachers/assignment-dialog";
import { RosterSection } from "./roster-section";
import { ActionHistory } from "./action-history";
import { ClassSessions, GenerationNotice } from "./class-sessions";

const SECTIONS = ["alunos", "aulas", "planejamento"] as const;
export function ClassPage({ id }: { id: string }): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  return (
    <div className="scrollbar-subtle h-full min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
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
      {query.isPending && <InlineSkeleton className="h-40 w-full" aria-label="Carregando turma" />}
      {query.data && <ClassDetailView key={id} detail={query.data} />}
    </div>
  );
}
function ClassDetailView({ detail }: { detail: RouterOutputs["classes"]["byId"] }): ReactElement {
  const [assigning, setAssigning] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  return (
    <div className="grid min-w-0 gap-5">
      <ClassOverview detail={detail} onAssign={() => setAssigning(true)} />
      <GenerationNotice classId={detail.id} />
      <ClassSections detail={detail} enroll={() => setMembershipOpen(true)} />
      {assigning && (
        <AssignmentDialog
          classId={detail.id}
          classCode={detail.portalClassName}
          onClose={() => setAssigning(false)}
        />
      )}
      {membershipOpen && (
        <MembershipDialog
          mode="ENTRY"
          classId={detail.id}
          scheduleType={detail.scheduleType}
          open
          onOpenChange={setMembershipOpen}
        />
      )}
    </div>
  );
}
type ClassSectionsInput = { detail: RouterOutputs["classes"]["byId"]; enroll: () => void };
function ClassSections({ detail, enroll }: ClassSectionsInput): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("alunos"),
  );
  const [search, setSearch] = useState("");
  return (
    <Tabs
      className="min-w-0"
      value={section}
      variant="underline"
      onValueChange={(value: string | null) => void setSection(classSection(value))}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <ClassSectionTabs />
        <ClassTools
          classId={detail.id}
          showStudents={section === "alunos"}
          search={search}
          onSearchChange={setSearch}
          enroll={enroll}
        />
      </div>
      <TabsPanel value="alunos">
        <RosterSection
          key={`${detail.id}/${search}`}
          classId={detail.id}
          search={search}
          showStage={detail.scheduleType === "PERSONALIZED"}
        />
      </TabsPanel>
      <TabsPanel value="planejamento">
        <PlanningPage classId={detail.id} />
      </TabsPanel>
      <TabsPanel value="aulas">
        <ClassSessions classId={detail.id} />
      </TabsPanel>
    </Tabs>
  );
}

function ClassTools({
  classId,
  showStudents,
  search,
  onSearchChange,
  enroll,
}: {
  classId: string;
  showStudents: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  enroll: () => void;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {showStudents && (
        <Input
          aria-label="Buscar aluno na turma"
          name="search"
          autoComplete="off"
          className="w-44"
          size="sm"
          placeholder="Buscar aluno"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      )}
      <ActionHistory classId={classId} />
      {showStudents && (
        <Button size="sm" onClick={enroll}>
          <UserRoundPlus aria-hidden />
          Matricular aluno
        </Button>
      )}
    </div>
  );
}

function ClassSectionTabs(): ReactElement {
  return (
    <TabsList aria-label="Seções da turma">
      <TabsTab value="alunos">
        <UsersRound aria-hidden />
        Alunos
      </TabsTab>
      <TabsTab value="aulas">
        <CalendarDays aria-hidden />
        Aulas
      </TabsTab>
      <TabsTab value="planejamento">Planejamento</TabsTab>
    </TabsList>
  );
}

function classSection(value: string | null): (typeof SECTIONS)[number] {
  return SECTIONS.find((section) => section === value) ?? "alunos";
}
