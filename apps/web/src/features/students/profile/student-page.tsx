"use client";
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
  const severeOverdue = finance.data?.debtState === "SEVERE_OVERDUE";
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
        onValueChange={(value) =>
          void setSection(
            value === "planejamento"
              ? "planejamento"
              : value === "financeiro"
                ? "financeiro"
                : "pedagogico",
          )
        }
      >
        <div className={styles.stickyHeader}>
          <DetailHeader
            title={profile ? profile.contact.fullName : <InlineSkeleton className="h-8 w-64" />}
            metadata={
              profile ? (
                <StudentStatus profile={profile} />
              ) : (
                <InlineSkeleton className="h-5 w-12" />
              )
            }
            actions={
              <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto">
                <TabsList
                  aria-label="Seções do aluno"
                  onPointerDownCapture={() => setPointerNavigation(true)}
                  onKeyDownCapture={() => setPointerNavigation(false)}
                >
                  <TabsTab value="pedagogico">
                    <BookOpen aria-hidden="true" />
                    Pedagógico
                  </TabsTab>
                  {(hasPpt || (pedagogy.isPending && section === "planejamento")) && (
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
                        <span className="sr-only">
                          Pendência grave: pagamento vencido há mais de 30 dias
                        </span>
                      </span>
                    )}
                  </TabsTab>
                </TabsList>
              </div>
            }
          />
          {profile && <StudentPendingActions studentId={id} name={profile.contact.fullName} />}
        </div>
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
          <div className="grid min-w-0 gap-4 pt-4">
            {pedagogy.isError ? (
              <ProfileError
                message="Não foi possível carregar a matrícula."
                onRetry={() => void pedagogy.refetch()}
              />
            ) : profile && pedagogy.data ? (
              pedagogy.data.enrollments
                .filter(
                  (enrollment) =>
                    enrollment.current && enrollment.class.scheduleType === "PERSONALIZED",
                )
                .map((enrollment) => (
                  <CurrentEnrollment
                    key={enrollment.id}
                    enrollment={enrollment}
                    today={pedagogy.data?.today ?? ""}
                    profile={profile}
                  />
                ))
            ) : (
              <EnrollmentLoading />
            )}
            <StudentPlanning studentId={id} />
          </div>
        </TabsPanel>
        <TabsPanel value="financeiro">
          <StudentFinanceSection id={id} profile={profile} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
