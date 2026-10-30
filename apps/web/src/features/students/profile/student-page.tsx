"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
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
import { firstTwoNames } from "~/lib/format";
import { useAnimationPreviewDelay } from "~/lib/animation-preview";
import { StudentPhoto } from "~/features/student-documents/student-photo";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { useStudentProfile, useStudentPedagogy, type StudentProfile } from "./logic";
import { StudentStatus } from "./student-identity";
import { ProfileError } from "./profile-shared";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";
import { StudentRegistrationLoading, StudentRegistrationSection } from "./student-registration";
import { StudentContractRenewal } from "./student-contract-renewal";
import { StudentOverview, StudentOverviewLoading } from "./student-overview";
import { StudentAgendaDialog } from "./student-agenda-dialog";
import { CurrentEnrollment } from "./current-enrollment";
import { PedagogyLoading, EnrollmentLoading } from "./student-loading";
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
  const header = studentHeaderProps({
    id,
    profile,
    pedagogy,
    registrationBusy,
    activeSection,
    entranceComplete,
    financePending: finance.isPending,
    pendingRenewals: finance.data?.pendingRenewals,
  });
  const content = {
    section: activeSection,
    id,
    profile,
    pedagogy,
    hasPpt,
    latestTermination: finance.data?.latestTermination,
    pedagogyWorkspacePreview,
    navigate,
    onBusyChange: setRegistrationBusy,
  } satisfies Parameters<typeof SectionContent>[0];
  return (
    <StudentSectionsView
      {...{ profile, activeSection, activeTab, entranceComplete, navigate, header, content }}
    />
  );
}

function StudentSectionsView({
  profile,
  activeSection,
  activeTab,
  entranceComplete,
  navigate,
  header,
  content,
}: {
  profile: StudentProfile | undefined;
  activeSection: StudentSection;
  activeTab: StudentSection;
  entranceComplete: boolean;
  navigate: ReturnType<typeof useStudentSectionNavigation>["navigate"];
  header: Parameters<typeof SectionsHeader>[0];
  content: Parameters<typeof SectionContent>[0];
}): ReactElement {
  return (
    <div
      className={styles.sections}
      data-overview={activeSection === OVERVIEW_SECTION || undefined}
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
        <SectionsHeader {...header} />
        <TabsPanel key={activeSection} value={activeTab}>
          <SectionContent {...content} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function studentHeaderProps({
  id,
  profile,
  pedagogy,
  registrationBusy,
  activeSection,
  entranceComplete,
  financePending,
  pendingRenewals,
}: {
  id: string;
  profile: StudentProfile | undefined;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
  registrationBusy: boolean;
  activeSection: StudentSection;
  entranceComplete: boolean;
  financePending: boolean;
  pendingRenewals: RouterOutputs["finance"]["studentSummary"]["pendingRenewals"] | undefined;
}): Parameters<typeof SectionsHeader>[0] {
  return {
    id,
    profile,
    canSchedule: Boolean(pedagogy.data?.enrollments.some((row) => row.current)),
    registrationBusy,
    financeActive: activeSection === "financeiro",
    renewalReady: entranceComplete && Boolean(profile) && !financePending,
    pendingRenewals: pendingRenewals ?? [],
  };
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
  financeActive,
  renewalReady,
  pendingRenewals,
}: {
  id: string;
  profile: StudentProfile | undefined;
  canSchedule: boolean;
  registrationBusy: boolean;
  financeActive: boolean;
  renewalReady: boolean;
  pendingRenewals: RouterOutputs["finance"]["studentSummary"]["pendingRenewals"];
}): ReactElement {
  return (
    <div className={styles.stickyHeader} data-ready={profile ? true : undefined}>
      <StudentIdentityHeader
        id={id}
        profile={profile}
        canSchedule={canSchedule}
        renewalAction={
          financeActive && pendingRenewals.length > 0 ? (
            <StudentContractRenewal contracts={pendingRenewals} ready={renewalReady} />
          ) : undefined
        }
        navigation={<StudentTabsNavigation disabled={registrationBusy} />}
      />
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
  renewalAction,
  navigation,
}: {
  id: string;
  profile: StudentProfile | undefined;
  canSchedule: boolean;
  renewalAction: ReactNode;
  navigation: ReactNode;
}): ReactElement {
  return (
    <DetailHeader
      size="sm"
      title={
        profile ? (
          firstTwoNames(profile.contact.fullName)
        ) : (
          <InlineSkeleton shape="block" className="h-7 w-48 max-w-full sm:w-64" />
        )
      }
      leading={
        profile ? (
          <StudentPhoto studentId={id} name={profile.contact.fullName} />
        ) : (
          <InlineSkeleton className="size-10" />
        )
      }
      metadata={
        <>
          {profile ? (
            <StudentStatus profile={profile} />
          ) : (
            <InlineSkeleton shape="block" className="h-5 w-12" />
          )}
          <StudentHeaderActions
            profile={profile}
            canSchedule={canSchedule}
            renewalAction={renewalAction}
          />
        </>
      }
      actions={navigation}
    />
  );
}

function StudentHeaderActions({
  profile,
  canSchedule,
  renewalAction,
}: {
  profile: StudentProfile | undefined;
  canSchedule: boolean;
  renewalAction: ReactNode;
}): ReactElement {
  return (
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
        <StudentAgendaDialog
          profile={profile}
          canSchedule={canSchedule}
          secondary={Boolean(renewalAction)}
        />
      ) : (
        <Button size="sm" disabled>
          <CalendarDays aria-hidden="true" /> Agenda do aluno
        </Button>
      )}
      {renewalAction}
    </div>
  );
}

function StudentTabsNavigation({ disabled }: { disabled: boolean }): ReactElement {
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
