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
import type { RouterOutputs } from "@lazuli/api";
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

const OVERVIEW_SECTION = "visao-geral";
const PEDAGOGY_SECTION = "pedagogico";
const PLANNING_SECTION = "planejamento";
const SECTIONS = [
  OVERVIEW_SECTION,
  "cadastro",
  PEDAGOGY_SECTION,
  PLANNING_SECTION,
  "financeiro",
] as const;
const PREVIEW_DELAY_MS = 1800;
const ENTRANCE_DURATION_MS = 720;
const SECTION_QUERY = "secao";
type StudentSection = (typeof SECTIONS)[number];
type PageProps = { id: string; pedagogyWorkspacePreview?: ReactNode };
type SectionsProps = PageProps & { profile: StudentProfile | undefined };

export function StudentPage({ id, pedagogyWorkspacePreview }: PageProps): ReactElement {
  const profile = useStudentProfile(id);
  const previewReady = useAnimationPreviewDelay(PREVIEW_DELAY_MS);
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
  const pedagogy = useStudentPedagogy(id);
  const finance = trpc.finance.studentSummary.useQuery({ studentId: id });
  const entranceComplete = useEntranceComplete(Boolean(profile));
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const hasPpt = hasPersonalizedEnrollment(pedagogy.data);
  const { activeSection, activeTab, navigate } = useStudentSectionNavigation({
    pedagogyReady: Boolean(pedagogy.data),
    hasPpt,
    registrationBusy,
  });
  return (
    <div
      className={styles.sections}
      data-ready={Boolean(profile) || undefined}
      data-entering={profile && !entranceComplete ? true : undefined}
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
        <SectionsHeader
          id={id}
          profile={profile}
          canSchedule={Boolean(pedagogy.data?.enrollments.some((row) => row.current))}
          registrationBusy={registrationBusy}
          severeOverdue={finance.data?.debtState === "SEVERE_OVERDUE"}
        />
        <TabsPanel key={activeSection} value={activeTab}>
          <SectionContent
            section={activeSection}
            id={id}
            profile={profile}
            pedagogy={pedagogy}
            hasPpt={hasPpt}
            latestTermination={finance.data?.latestTermination}
            pedagogyWorkspacePreview={pedagogyWorkspacePreview}
            navigate={navigate}
            onBusyChange={setRegistrationBusy}
          />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function hasPersonalizedEnrollment(data: ReturnType<typeof useStudentPedagogy>["data"]): boolean {
  return Boolean(data?.enrollments.some((row) => row.class.scheduleType === "PERSONALIZED"));
}

function useStudentSectionNavigation({
  pedagogyReady,
  hasPpt,
  registrationBusy,
}: {
  pedagogyReady: boolean;
  hasPpt: boolean;
  registrationBusy: boolean;
}): {
  activeSection: StudentSection;
  activeTab: StudentSection;
  navigate: (next: StudentSection) => void;
} {
  const switchSection = useSectionCarousel();
  const [section, setSection] = useQueryState(
    SECTION_QUERY,
    parseAsStringLiteral(SECTIONS).withDefault(OVERVIEW_SECTION),
  );
  const activeSection = resolveSection(section, { pedagogyReady, hasPpt });
  const activeTab = activeSection === PLANNING_SECTION ? PEDAGOGY_SECTION : activeSection;
  const navigate = (next: StudentSection): void => {
    if (registrationBusy) return;
    switchSection(activeSection, { next, update: () => void setSection(next) });
  };
  return { activeSection, activeTab, navigate };
}

function useEntranceComplete(ready: boolean): boolean {
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (!ready || complete) return;
    const timeout = globalThis.setTimeout(() => setComplete(true), ENTRANCE_DURATION_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [ready, complete]);
  return complete;
}

function resolveSection(
  section: StudentSection,
  { pedagogyReady, hasPpt }: { pedagogyReady: boolean; hasPpt: boolean },
): StudentSection {
  if (section === PLANNING_SECTION && pedagogyReady && !hasPpt) return PEDAGOGY_SECTION;
  return section;
}

function SectionsHeader({
  id,
  profile,
  canSchedule,
  registrationBusy,
  severeOverdue,
}: {
  id: string;
  profile: StudentProfile | undefined;
  canSchedule: boolean;
  registrationBusy: boolean;
  severeOverdue: boolean;
}): ReactElement {
  return (
    <div className={styles.stickyHeader} data-ready={profile ? true : undefined}>
      <StudentIdentityHeader id={id} profile={profile} canSchedule={canSchedule} />
      {profile && <StudentPendingActions studentId={id} name={profile.contact.fullName} />}
      <StudentTabsNavigation disabled={registrationBusy} severeOverdue={severeOverdue} />
    </div>
  );
}

type SectionContentProps = {
  section: StudentSection;
  id: string;
  profile: StudentProfile | undefined;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
  hasPpt: boolean;
  latestTermination: RouterOutputs["finance"]["studentSummary"]["latestTermination"] | undefined;
  pedagogyWorkspacePreview: ReactNode;
  navigate: (section: StudentSection) => void;
  onBusyChange: (busy: boolean) => void;
};
type PedagogySectionProps = Pick<
  SectionContentProps,
  "section" | "id" | "profile" | "pedagogy" | "latestTermination" | "pedagogyWorkspacePreview"
>;

function SectionContent(props: SectionContentProps): ReactElement {
  const { section, id, profile, navigate, onBusyChange } = props;
  return (
    <div className={styles.tabContent}>
      {section === OVERVIEW_SECTION &&
        (profile ? (
          <StudentOverview profile={profile} navigate={navigate} />
        ) : (
          <StudentOverviewLoading />
        ))}
      {section === "cadastro" &&
        (profile ? (
          <StudentRegistrationSection profile={profile} onBusyChange={onBusyChange} />
        ) : (
          <StudentRegistrationLoading />
        ))}
      {(section === PEDAGOGY_SECTION || section === PLANNING_SECTION) && (
        <PedagogyContent {...props} />
      )}
      {section === "financeiro" && <StudentFinanceSection id={id} profile={profile} />}
    </div>
  );
}

function PedagogyContent({
  section,
  id,
  profile,
  pedagogy,
  hasPpt,
  latestTermination,
  pedagogyWorkspacePreview,
  navigate,
}: SectionContentProps): ReactElement {
  return (
    <div className={styles.pedagogyContent}>
      {(hasPpt || section === PLANNING_SECTION) && (
        <SegmentedControl
          size="sm"
          aria-label="Área pedagógica"
          value={section}
          onValueChange={(value) => {
            if (value === PEDAGOGY_SECTION || value === PLANNING_SECTION) navigate(value);
          }}
        >
          <SegmentedControlItem value={PEDAGOGY_SECTION}>Acompanhamento</SegmentedControlItem>
          <SegmentedControlItem value={PLANNING_SECTION}>Plano de ensino PPT</SegmentedControlItem>
        </SegmentedControl>
      )}
      <PedagogySection
        section={section}
        id={id}
        profile={profile}
        pedagogy={pedagogy}
        latestTermination={latestTermination}
        pedagogyWorkspacePreview={pedagogyWorkspacePreview}
      />
    </div>
  );
}

function PedagogySection({
  section,
  id,
  profile,
  pedagogy,
  latestTermination,
  pedagogyWorkspacePreview,
}: PedagogySectionProps): ReactElement {
  if (section === PLANNING_SECTION)
    return <StudentPlanningPanel id={id} profile={profile} pedagogy={pedagogy} />;
  if (profile)
    return (
      <StudentPedagogySection
        profile={profile}
        latestTermination={latestTermination}
        pedagogyWorkspacePreview={pedagogyWorkspacePreview}
      />
    );
  return <PedagogyLoading />;
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
        <TabsTab value={OVERVIEW_SECTION} disabled={disabled}>
          <LayoutDashboard aria-hidden="true" /> Visão geral
        </TabsTab>
        <TabsTab value="cadastro">
          <UserRound aria-hidden="true" /> Cadastro
        </TabsTab>
        <TabsTab value={PEDAGOGY_SECTION} disabled={disabled}>
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
