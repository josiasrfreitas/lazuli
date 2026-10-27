"use client";
import { StudentPhoto } from "~/features/student-documents/student-photo";
import { useState, type ReactElement, type ReactNode } from "react";
import { AlertCircle, BookOpen, CalendarDays, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsTab, TabsPanel, DetailHeader, InlineSkeleton } from "@lazuli/ui";
import { useStudentProfile, useStudentPedagogy, type StudentProfile } from "./logic";
import { StudentStatus } from "./student-identity";
import { ProfileError } from "./profile-shared";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";

import { trpc } from "~/lib/trpc";

import { CurrentEnrollment } from "./current-enrollment";
import { PedagogyLoading, EnrollmentLoading } from "./student-loading";

import styles from "./student-profile.module.css";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { StudentPendingActions } from "./student-pending-actions";

const SECTIONS = ["pedagogico", "financeiro", "planejamento"] as const;
type PedagogyProps = {
  id: string;
  profile?: StudentProfile | undefined;
  pedagogyWorkspacePreview?: ReactNode;
};

export function StudentPage({
  id,
  pedagogyWorkspacePreview,
}: {
  id: string;
  pedagogyWorkspacePreview?: ReactNode;
}): ReactElement {
  const profile = useStudentProfile(id);
  return (
    <div data-page-scroll="internal" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {profile.isError && (
          <ProfileError message={profile.error.message} onRetry={() => void profile.refetch()} />
        )}
        {!profile.isError && (
          <StudentSections
            id={id}
            profile={profile.data}
            pedagogyWorkspacePreview={pedagogyWorkspacePreview}
          />
        )}
      </div>
    </div>
  );
}

function StudentSections({ id, profile, pedagogyWorkspacePreview }: PedagogyProps): ReactElement {
  const pedagogy = useStudentPedagogy(id);
  const hasPpt = pedagogy.data?.enrollments.some(
    (row) => row.class.scheduleType === "PERSONALIZED",
  );
  const finance = trpc.finance.studentSummary.useQuery({ studentId: id });
  const [pointerNavigation, setPointerNavigation] = useState(false);
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("pedagogico"),
  );
  return (
    <div className={styles.sections} data-pointer-navigation={pointerNavigation || undefined}>
      <Tabs
        value={section === "planejamento" && pedagogy.data && !hasPpt ? "pedagogico" : section}
        variant="underline"
        size="md"
        onValueChange={(value) => {
          if (typeof value === "string") void setSection(studentSectionFromTab(value));
        }}
      >
        <StudentTabsHeader
          id={id}
          profile={profile}
          hasPpt={Boolean(hasPpt)}
          showPendingPlanning={pedagogy.isPending && section === "planejamento"}
          severeOverdue={finance.data?.debtState === "SEVERE_OVERDUE"}
          onPointerNavigationChange={setPointerNavigation}
        />
        <TabsPanel value="pedagogico">
          {profile ? (
            <StudentPedagogySection
              profile={profile}
              latestTermination={finance.data?.latestTermination}
              pedagogyWorkspacePreview={pedagogyWorkspacePreview}
            />
          ) : (
            <PedagogyLoading />
          )}
        </TabsPanel>
        <TabsPanel value="planejamento">
          <StudentPlanningPanel id={id} profile={profile} pedagogy={pedagogy} />
        </TabsPanel>
        <TabsPanel value="financeiro">
          <StudentFinanceSection id={id} profile={profile} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function studentSectionFromTab(value: string): (typeof SECTIONS)[number] {
  if (value === "planejamento") return "planejamento";
  if (value === "financeiro") return "financeiro";
  return "pedagogico";
}

function StudentTabsHeader({
  id,
  profile,
  hasPpt,
  showPendingPlanning,
  severeOverdue,
  onPointerNavigationChange,
}: {
  id: string;
  profile: StudentProfile | undefined;
  hasPpt: boolean;
  showPendingPlanning: boolean;
  severeOverdue: boolean;
  onPointerNavigationChange: (value: boolean) => void;
}): ReactElement {
  return (
    <div className={styles.stickyHeader}>
      <DetailHeader
        title={profile ? profile.contact.fullName : <InlineSkeleton className="h-8 w-64" />}
        leading={
          profile ? <StudentPhoto studentId={id} name={profile.contact.fullName} /> : undefined
        }
        metadata={
          profile ? <StudentStatus profile={profile} /> : <InlineSkeleton className="h-5 w-12" />
        }
        actions={
          <StudentTabsNavigation
            hasPpt={hasPpt}
            showPendingPlanning={showPendingPlanning}
            severeOverdue={severeOverdue}
            onPointerNavigationChange={onPointerNavigationChange}
          />
        }
      />
      {profile && <StudentPendingActions studentId={id} name={profile.contact.fullName} />}
    </div>
  );
}

function StudentTabsNavigation({
  hasPpt,
  showPendingPlanning,
  severeOverdue,
  onPointerNavigationChange,
}: {
  hasPpt: boolean;
  showPendingPlanning: boolean;
  severeOverdue: boolean;
  onPointerNavigationChange: (value: boolean) => void;
}): ReactElement {
  return (
    <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto">
      <TabsList
        aria-label="Seções do aluno"
        onPointerDownCapture={() => onPointerNavigationChange(true)}
        onKeyDownCapture={() => onPointerNavigationChange(false)}
      >
        <TabsTab value="pedagogico">
          <BookOpen aria-hidden="true" />
          Pedagógico
        </TabsTab>
        {(hasPpt || showPendingPlanning) && (
          <TabsTab value="planejamento">
            <CalendarDays aria-hidden="true" />
            Planejamento
          </TabsTab>
        )}
        <TabsTab value="financeiro">
          <Wallet aria-hidden="true" />
          Financeiro
          {severeOverdue && (
            <span
              className="text-destructive"
              title="Pendência grave: pagamento vencido há mais de 30 dias"
            >
              <AlertCircle className={styles.financeAlert} aria-hidden="true" />
              <span className="sr-only">Pendência grave: pagamento vencido há mais de 30 dias</span>
            </span>
          )}
        </TabsTab>
      </TabsList>
    </div>
  );
}

function StudentPlanningPanel({
  id,
  profile,
  pedagogy,
}: {
  id: string;
  profile: StudentProfile | undefined;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-4 pt-4">
      <StudentPlanningEnrollments profile={profile} pedagogy={pedagogy} />
      <StudentPlanning studentId={id} />
    </div>
  );
}

function StudentPlanningEnrollments({
  profile,
  pedagogy,
}: {
  profile: StudentProfile | undefined;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
}): ReactNode {
  if (pedagogy.isError)
    return (
      <ProfileError
        message="Não foi possível carregar a matrícula."
        onRetry={() => void pedagogy.refetch()}
      />
    );
  if (!profile || !pedagogy.data) return <EnrollmentLoading />;
  return pedagogy.data.enrollments
    .filter((enrollment) => enrollment.current && enrollment.class.scheduleType === "PERSONALIZED")
    .map((enrollment) => (
      <CurrentEnrollment
        key={enrollment.id}
        enrollment={enrollment}
        today={pedagogy.data?.today ?? ""}
        profile={profile}
      />
    ));
}
