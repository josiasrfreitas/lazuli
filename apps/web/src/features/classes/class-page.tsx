"use client";
import { useEffect, useState, type ReactElement } from "react";
import {
  BookOpen,
  LayoutDashboard,
  AlertCircle,
  CalendarDays,
  ChartNoAxesCombined,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Button, Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import { ClassRecentOccurrences } from "./class-recent-occurrences";
import { ClassPageLoading } from "./class-page-loading";
import { ClassIdentityHeader, ClassOverview } from "./class-overview";
import { MembershipDialog } from "./membership-dialog";
import { AssignmentDialog } from "../teachers/assignment-dialog";
import { ClassPerformance } from "~/features/assessments/class-performance";
import { ClassLessons } from "./class-lessons";
import { RosterSection } from "./roster-section";
import { GenerationNotice } from "../class-records/generation-notice";
import styles from "./class-page.module.css";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import planningStyles from "~/features/stage-planning/planning.module.css";

const OVERVIEW_SECTION = "visao-geral";
const SECTIONS = [OVERVIEW_SECTION, "alunos", "desempenho", "aulas", "planejamento"] as const;
const REDUCED_ARRIVAL_DELAY_MS = 100;
const ARRIVAL_DELAY_MS = 460;

export function ClassPage({ id }: { id: string }): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  return (
    <div data-page-scroll="internal" className={styles.scrollport}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
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
        {query.isPending && <ClassPageLoading />}
        {query.data && <ClassDetailView key={id} detail={query.data} />}
      </div>
    </div>
  );
}

function ClassDetailView({ detail }: { detail: RouterOutputs["classes"]["byId"] }): ReactElement {
  const [action, setAction] = useQueryState("acao", parseAsString);
  const [arrivalReady, setArrivalReady] = useState(action !== "professor");
  useEffect(() => {
    if (arrivalReady) return;
    const delay = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? REDUCED_ARRIVAL_DELAY_MS
      : ARRIVAL_DELAY_MS;
    const timer = globalThis.setTimeout(() => setArrivalReady(true), delay);
    return () => globalThis.clearTimeout(timer);
  }, [arrivalReady]);
  const assigning = action === "professor" && arrivalReady;
  const setAssigning = (open: boolean): void => {
    setArrivalReady(true);
    void setAction(open ? "professor" : null);
  };
  const [membershipOpen, setMembershipOpen] = useState(false);
  return (
    <>
      <ClassSections
        detail={detail}
        onAssign={() => setAssigning(true)}
        enroll={() => setMembershipOpen(true)}
      />
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
  onAssign,
}: {
  onAssign: () => void;
  detail: RouterOutputs["classes"]["byId"];
  enroll: () => void;
}): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault(OVERVIEW_SECTION),
  );
  const pendingLessons = usePendingLessonCount(detail.id);
  const switchSection = useSectionCarousel({ order: SECTIONS, scope: "classCarousel" });
  const changeSection = (value: string): void => {
    const selected = SECTIONS.find((candidate) => candidate === value) ?? OVERVIEW_SECTION;
    switchSection(activeSection, { next: selected, update: () => void setSection(selected) });
  };
  // Old links to the roster now open the combined overview.
  const activeSection =
    section === "alunos" || (section === "planejamento" && detail.scheduleType !== "REGULAR")
      ? OVERVIEW_SECTION
      : section;
  return (
    <div
      className={styles.sections}
      data-planning={(section === "planejamento" && detail.scheduleType === "REGULAR") || undefined}
      data-lessons={section === "aulas" || undefined}
      data-overview={activeSection === OVERVIEW_SECTION || undefined}
    >
      <Tabs value={activeSection} variant="underline" size="md" onValueChange={changeSection}>
        <div className={styles.header}>
          <ClassIdentityHeader
            detail={detail}
            onAssign={onAssign}
            navigation={
              <div className={styles.tabNavigation}>
                <ClassTabs
                  regular={detail.scheduleType === "REGULAR"}
                  pendingLessons={pendingLessons}
                />
              </div>
            }
          />
        </div>
        <ClassSectionPanels detail={detail} enroll={enroll} />
      </Tabs>
    </div>
  );
}

function ClassSectionPanels({
  detail,
  enroll,
}: {
  detail: RouterOutputs["classes"]["byId"];
  enroll: () => void;
}): ReactElement {
  return (
    <>
      <TabsPanel value={OVERVIEW_SECTION}>
        <ClassOverview detail={detail} />
        <div className={styles.overviewWorkspace}>
          <ClassRecentOccurrences classId={detail.id} />
          <RosterSection
            classId={detail.id}
            showStage={detail.scheduleType === "PERSONALIZED"}
            enroll={enroll}
          />
        </div>
      </TabsPanel>
      <TabsPanel value="desempenho">
        <ClassPerformance classId={detail.id} />
      </TabsPanel>
      <TabsPanel value="aulas" className="flex flex-1 flex-col">
        <ClassLessons classId={detail.id} />
      </TabsPanel>
      {detail.scheduleType === "REGULAR" && <ClassPlanningPanel classId={detail.id} />}
      <GenerationNotice classId={detail.id} />
    </>
  );
}

function usePendingLessonCount(classId: string): number {
  const progress = trpc.classRecords.progress.useQuery(
    { classId },
    { retry: false, refetchInterval: 60_000 },
  );
  return progress.data?.pendingCount ?? 0;
}

function ClassPlanningPanel({ classId }: { classId: string }): ReactElement {
  return (
    <TabsPanel value="planejamento">
      <div className={planningStyles.classPanel}>
        <PlanningWorkspace classId={classId} />
      </div>
    </TabsPanel>
  );
}

function ClassTabs({
  regular,
  pendingLessons,
}: {
  regular: boolean;
  pendingLessons: number;
}): ReactElement {
  return (
    <TabsList aria-label="Seções da turma">
      <TabsTab value={OVERVIEW_SECTION}>
        <LayoutDashboard aria-hidden="true" />
        Visão geral
      </TabsTab>
      <TabsTab value="desempenho">
        <ChartNoAxesCombined aria-hidden="true" />
        Desempenho
      </TabsTab>
      <TabsTab value="aulas">
        <CalendarDays aria-hidden="true" />
        Aulas
        {pendingLessons > 0 && <PendingLessonsAlert count={pendingLessons} />}
      </TabsTab>
      {regular && (
        <TabsTab value="planejamento">
          <BookOpen aria-hidden="true" />
          Planejamento
        </TabsTab>
      )}
    </TabsList>
  );
}

function PendingLessonsAlert({ count }: { count: number }): ReactElement {
  const label = `${count} ${count === 1 ? "aula sem registro" : "aulas sem registro"} há pelo menos 3 dias`;
  return (
    <span className="text-warning" title={label}>
      <AlertCircle className={styles.lessonAlert} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
