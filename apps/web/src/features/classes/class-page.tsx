"use client";
import { useState, type ReactElement } from "react";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Button, Tabs, TabsList, TabsPanel, TabsTab, useStickyBoundary } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { ClassOverviewLoading } from "./class-overview-loading";
import { ClassOverview } from "./class-overview";
import { MembershipDialog } from "./membership-dialog";
import { AssignmentDialog } from "../teachers/assignment-dialog";
import { ClassPerformance } from "~/features/assessments/class-performance";
import { ClassLessons } from "./class-lessons";
import { RosterSection } from "./roster-section";
import { GenerationNotice } from "../class-records/generation-notice";
import styles from "./class-page.module.css";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import planningStyles from "~/features/stage-planning/planning.module.css";

const SECTIONS = ["alunos", "desempenho", "aulas", "planejamento"] as const;

export function ClassPage({ id }: { id: string }): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  return (
    <div className={styles.scrollport}>
      <div className="grid w-full min-w-0 gap-4 px-4 pt-5 sm:px-6 lg:px-8">
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
        {query.isPending && <ClassOverviewLoading />}
        {query.data && <ClassDetailView key={id} detail={query.data} />}
      </div>
    </div>
  );
}

function ClassDetailView({ detail }: { detail: RouterOutputs["classes"]["byId"] }): ReactElement {
  const [assigning, setAssigning] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  return (
    <>
      <ClassOverview detail={detail} onAssign={() => setAssigning(true)} />
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
          classLabel={`${detail.portalClassName}${detail.sharedStage ? ` · ${detail.sharedStage.name}` : ""}`}
          scheduleType={detail.scheduleType}
          open
          onOpenChange={setMembershipOpen}
        />
      )}
    </>
  );
}

function ClassSections({
  detail,
  enroll,
}: {
  detail: RouterOutputs["classes"]["byId"];
  enroll: () => void;
}): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("alunos"),
  );
  return (
    <div
      className={styles.sections}
      data-planning={(section === "planejamento" && detail.scheduleType === "REGULAR") || undefined}
    >
      <Tabs
        value={section === "planejamento" && detail.scheduleType !== "REGULAR" ? "alunos" : section}
        variant="underline"
        size="md"
        onValueChange={(value) =>
          void setSection(
            value === "planejamento"
              ? "planejamento"
              : value === "aulas"
                ? "aulas"
                : value === "desempenho"
                  ? "desempenho"
                  : "alunos",
          )
        }
      >
        <ClassNavigation
          regular={detail.scheduleType === "REGULAR"}
          planning={section === "planejamento" && detail.scheduleType === "REGULAR"}
          enroll={enroll}
        />
        <TabsPanel value="alunos">
          <RosterSection classId={detail.id} showStage={detail.scheduleType === "PERSONALIZED"} />
        </TabsPanel>
        <TabsPanel value="desempenho">
          <ClassPerformance classId={detail.id} />
        </TabsPanel>
        <TabsPanel value="aulas">
          <ClassLessons classId={detail.id} />
        </TabsPanel>
        {detail.scheduleType === "REGULAR" && (
          <TabsPanel value="planejamento">
            <div className={planningStyles.classPanel}>
              <PlanningWorkspace classId={detail.id} />
            </div>
          </TabsPanel>
        )}
        <GenerationNotice classId={detail.id} />
      </Tabs>
    </div>
  );
}

function ClassNavigation({
  regular,
  planning,
  enroll,
}: {
  regular: boolean;
  planning: boolean;
  enroll: () => void;
}): ReactElement {
  const { sentinelRef, stuck } = useStickyBoundary(true);
  return (
    <>
      <span
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-px w-px"
      />
      <div className={styles.navigation} data-stuck={stuck || undefined}>
        <TabsList aria-label="Seções da turma">
          <TabsTab value="alunos">
            <UsersRound aria-hidden="true" />
            Alunos
          </TabsTab>
          <TabsTab value="desempenho">
            <ChartNoAxesCombined aria-hidden="true" />
            Desempenho
          </TabsTab>
          <TabsTab value="aulas">
            <CalendarDays aria-hidden="true" />
            Aulas
          </TabsTab>
          {regular && (
            <TabsTab value="planejamento">
              <BookOpen aria-hidden="true" />
              Planejamento
            </TabsTab>
          )}
        </TabsList>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {!planning && (
            <Button size="sm" onClick={enroll}>
              <UserRoundPlus aria-hidden="true" />
              Matricular aluno
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
