"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  UserRound,
  Wallet,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  Button,
  DetailHeader,
  InlineSkeleton,
  SegmentedControl,
  SegmentedControlItem,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { useAnimationPreviewDelay } from "~/lib/animation-preview";
import { StudentPhoto } from "~/features/student-documents/student-photo";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { useStudentProfile, useStudentPedagogy, type StudentProfile } from "./logic";
import { StudentStatus } from "./student-identity";
import { ProfileError } from "./profile-shared";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";
import { StudentRegistrationLoading, StudentRegistrationSection } from "./student-registration";
import { StudentOverview, StudentOverviewLoading } from "./student-overview";
import { StudentAgendaDialog } from "./student-agenda-dialog";
import { CurrentEnrollment } from "./current-enrollment";
import { PedagogyLoading, EnrollmentLoading } from "./student-loading";
import { StudentPendingActions } from "./student-pending-actions";
import { useSectionCarousel } from "./use-section-carousel";
import styles from "./student-profile.module.css";

const SECTIONS = ["visao-geral", "cadastro", "pedagogico", "planejamento", "financeiro"] as const;
type StudentSection = (typeof SECTIONS)[number];
type PageProps = { id: string; pedagogyWorkspacePreview?: ReactNode };
type SectionsProps = PageProps & { profile: StudentProfile | undefined };

export function StudentPage({ id, pedagogyWorkspacePreview }: PageProps): ReactElement {
  const profile = useStudentProfile(id);
  const previewReady = useAnimationPreviewDelay(1800);
  return (
    <div data-page-scroll="internal" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {profile.isError ? (
          <ProfileError message={profile.error.message} onRetry={() => void profile.refetch()} />
        ) : (
          <StudentSections
            key={id}
            id={id}
            profile={previewReady ? profile.data : undefined}
            pedagogyWorkspacePreview={pedagogyWorkspacePreview}
          />
        )}
      </div>
    </div>
  );
}

function StudentSections({ id, profile, pedagogyWorkspacePreview }: SectionsProps): ReactElement {
  const switchSection = useSectionCarousel();
  const pedagogy = useStudentPedagogy(id);
  const finance = trpc.finance.studentSummary.useQuery({ studentId: id });
  const ready = Boolean(profile);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  useEffect(() => {
    if (!ready || entranceComplete) return;
    const timeout = window.setTimeout(() => setEntranceComplete(true), 720);
    return () => window.clearTimeout(timeout);
  }, [ready, entranceComplete]);
  const hasPpt = Boolean(
    pedagogy.data?.enrollments.some((row) => row.class.scheduleType === "PERSONALIZED"),
  );
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("visao-geral"),
  );
  const activeSection =
    section === "planejamento" && pedagogy.data && !hasPpt ? "pedagogico" : section;
  const activeTab = activeSection === "planejamento" ? "pedagogico" : activeSection;
  const navigate = (next: StudentSection): void => {
    if (registrationBusy) return;
    switchSection(activeSection, next, () => {
      void setSection(next);
    });
  };
  return (
    <div
      className={styles.sections}
      data-ready={ready || undefined}
      data-entering={ready && !entranceComplete ? true : undefined}
    >
      <Tabs
        value={activeTab}
        variant="underline"
        size="md"
        onValueChange={(value) => {
          const next = SECTIONS.find((item) => item === value);
          if (next) navigate(next);
        }}
      >
        <div className={styles.stickyHeader} data-ready={profile ? true : undefined}>
          <StudentIdentityHeader
            id={id}
            profile={profile}
            canSchedule={Boolean(pedagogy.data?.enrollments.some((row) => row.current))}
          />
          {profile && <StudentPendingActions studentId={id} name={profile.contact.fullName} />}
          <StudentTabsNavigation
            disabled={registrationBusy}
            severeOverdue={finance.data?.debtState === "SEVERE_OVERDUE"}
          />
        </div>
        <TabsPanel key={activeSection} value={activeTab}>
          <div className={styles.tabContent}>
            {activeSection === "visao-geral" &&
              (profile ? (
                <StudentOverview profile={profile} navigate={navigate} />
              ) : (
                <StudentOverviewLoading />
              ))}
            {activeSection === "cadastro" &&
              (profile ? (
                <StudentRegistrationSection profile={profile} onBusyChange={setRegistrationBusy} />
              ) : (
                <StudentRegistrationLoading />
              ))}
            {(activeSection === "pedagogico" || activeSection === "planejamento") && (
              <div className={styles.pedagogyContent}>
                {(hasPpt || activeSection === "planejamento") && (
                  <SegmentedControl
                    size="sm"
                    aria-label="Área pedagógica"
                    value={activeSection}
                    onValueChange={(value) => {
                      if (value === "pedagogico" || value === "planejamento") navigate(value);
                    }}
                  >
                    <SegmentedControlItem value="pedagogico">Acompanhamento</SegmentedControlItem>
                    <SegmentedControlItem value="planejamento">
                      Plano de ensino PPT
                    </SegmentedControlItem>
                  </SegmentedControl>
                )}
                {activeSection === "planejamento" ? (
                  <StudentPlanningPanel id={id} profile={profile} pedagogy={pedagogy} />
                ) : profile ? (
                  <StudentPedagogySection
                    profile={profile}
                    latestTermination={finance.data?.latestTermination}
                    pedagogyWorkspacePreview={pedagogyWorkspacePreview}
                  />
                ) : (
                  <PedagogyLoading />
                )}
              </div>
            )}
            {activeSection === "financeiro" && <StudentFinanceSection id={id} profile={profile} />}
          </div>
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function StudentIdentityHeader({
  id,
  profile,
  canSchedule,
}: {
  id: string;
  profile: StudentProfile | undefined;
  canSchedule: boolean;
}): ReactElement {
  return (
    <DetailHeader
      title={
        profile ? profile.contact.fullName : <InlineSkeleton className="h-8 w-64 max-w-full" />
      }
      leading={
        profile ? <StudentPhoto studentId={id} name={profile.contact.fullName} /> : undefined
      }
      metadata={
        profile ? <StudentStatus profile={profile} /> : <InlineSkeleton className="h-5 w-12" />
      }
      actions={
        <div className={styles.headerActions}>
          {profile?.whatsAppUrl && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<a href={profile.whatsAppUrl} target="_blank" rel="noreferrer" />}
            >
              <MessageCircle aria-hidden="true" /> WhatsApp
            </Button>
          )}
          {profile ? (
            <StudentAgendaDialog profile={profile} canSchedule={canSchedule} />
          ) : (
            <Button size="sm" disabled>
              <CalendarDays aria-hidden="true" /> Agenda do aluno
            </Button>
          )}
        </div>
      }
    />
  );
}

function StudentTabsNavigation({
  severeOverdue,
  disabled,
}: {
  severeOverdue: boolean;
  disabled: boolean;
}): ReactElement {
  return (
    <div className={styles.tabNavigation}>
      <TabsList aria-label="Seções do aluno" className="min-w-full">
        <TabsTab value="visao-geral" disabled={disabled}>
          <LayoutDashboard aria-hidden="true" /> Visão geral
        </TabsTab>
        <TabsTab value="cadastro">
          <UserRound aria-hidden="true" /> Cadastro
        </TabsTab>
        <TabsTab value="pedagogico" disabled={disabled}>
          <BookOpen aria-hidden="true" /> Pedagógico
        </TabsTab>
        <TabsTab value="financeiro" disabled={disabled}>
          <Wallet aria-hidden="true" /> Financeiro
          {severeOverdue && (
            <span className="text-destructive" title="Pagamento vencido há mais de 30 dias">
              <AlertCircle className={styles.financeAlert} aria-hidden="true" />
              <span className="sr-only">Pagamento vencido há mais de 30 dias</span>
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
    <div className="grid min-w-0 gap-4">
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
