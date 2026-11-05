import type { ReactElement } from "react";
import { Inbox } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import type { BusinessData } from "./home-metrics";
import type { InitialDashboardData } from "./home";
import type { HomeData, HomeGroup } from "./home-parts";
import { PendingRenewals } from "./home-pending-renewals";
import { PendingFinance } from "./home-pending-finance";
import { trpc } from "~/lib/trpc";
import { PendingAppointments } from "./home-pending-appointments";
import { PendingOccurrences } from "./home-pending-occurrences";
import { PendingStudents } from "./home-pending-students";
import { PendingPlacement } from "./home-pending-placement";
import { PendingLessons } from "./home-pending-lessons";
import { PendingCoverage } from "./home-pending-coverage";
import styles from "./home-pending.module.css";

export function HomePending({
  data,
  business,
  loading,
  businessError,
  initialLessons,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  loading: boolean;
  businessLoading: boolean;
  businessError: boolean;
  initialLessons?: InitialDashboardData["pendingLessons"];
}): ReactElement {
  const lessons = trpc.dashboard.pendingLessonSummaries.useQuery(undefined, {
    refetchInterval: 60_000,
    ...(initialLessons
      ? { initialData: initialLessons.data, initialDataUpdatedAt: initialLessons.updatedAt }
      : {}),
  });
  const lessonState: PendingLessonState = {
    teachers: lessons.data ?? [],
    pending: lessons.isPending,
    error: lessons.isError,
    success: lessons.isSuccess,
    retry: () => void lessons.refetch(),
  };
  return (
    <section className={styles.pending} aria-labelledby="home-pending-title">
      <header className={styles.heading}>
        <h2 id="home-pending-title">Pendências</h2>
      </header>
      <div className={styles.scrollport}>
        <table className={styles.table} aria-label="Pendências">
          <tbody>
            <PendingRows
              data={data}
              business={business}
              loading={loading}
              businessError={businessError}
              lessons={lessonState}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

type PendingLessonState = {
  teachers: RouterOutputs["dashboard"]["pendingLessonSummaries"];
  pending: boolean;
  error: boolean;
  success: boolean;
  retry: () => void;
};

function PendingRows({
  data,
  business,
  loading,
  businessError,
  lessons,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  loading: boolean;
  businessError: boolean;
  lessons: PendingLessonState;
}): ReactElement {
  const groups = pendingGroups(data);
  const hasFinance = Boolean(data?.canViewFinance && business && business.overdueCents > 0);
  return (
    <>
      <PendingActionRows
        data={data}
        business={business}
        hasFinance={hasFinance}
        groups={groups}
        teachers={lessons.teachers}
      />
      <PendingFeedback
        {...groups}
        hasFinance={hasFinance}
        lessons={lessons}
        loading={loading}
        financeUnavailable={Boolean(businessError && data?.canViewFinance)}
      />
    </>
  );
}

type PendingGroups = {
  group: HomeGroup | undefined;
  appointments: HomeGroup | undefined;
  renewals: HomeGroup | undefined;
  placement: HomeGroup | undefined;
  students: HomeGroup | undefined;
  documents: HomeGroup | undefined;
  contracts: HomeGroup | undefined;
  occurrences: HomeGroup | undefined;
  health: HomeGroup | undefined;
};

function pendingGroups(data: HomeData | undefined): PendingGroups {
  const groups = data?.groups ?? [];
  const finance = Boolean(data?.canViewFinance);
  return {
    health: groups.find((item) => item.kind === "health"),
    occurrences: groups.find((item) => item.kind === "occurrences"),
    group: groups.find((item) => item.kind === "coverage"),
    appointments: groups.find((item) => item.kind === "appointments"),
    renewals: finance ? groups.find((item) => item.kind === "renewals") : undefined,
    placement: groups.find((item) => item.kind === "placement"),
    contracts: finance ? groups.find((item) => item.kind === "contracts") : undefined,
    students: groups.find((item) => item.kind === "students"),
    documents: groups.find((item) => item.kind === "documents"),
  };
}

function PendingActionRows({
  data,
  business,
  hasFinance,
  groups,
  teachers,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  hasFinance: boolean;
  groups: PendingGroups;
  teachers: PendingLessonState["teachers"];
}): ReactElement {
  const today = data?.today ?? "";
  const finance = Boolean(data?.canViewFinance);
  return (
    <>
      {hasFinance && business && <PendingFinance business={business} />}
      <PendingOccurrences group={groups.occurrences} />
      <PendingOccurrences group={groups.health} kind="health" />
      <PendingCoverage group={groups.group} today={today} />
      {finance && <PendingRenewals group={groups.renewals} today={today} />}
      <PendingAppointments group={groups.appointments} today={today} />
      <PendingPlacement group={groups.placement} today={today} />
      {finance && <PendingStudents group={groups.contracts} kind="contracts" />}
      <PendingStudents group={groups.students} />
      <PendingStudents group={groups.documents} kind="documents" />
      <PendingLessons teachers={teachers} />
    </>
  );
}

type PendingFeedbackProps = PendingGroups & {
  hasFinance: boolean;
  lessons: PendingLessonState;
  loading: boolean;
  financeUnavailable: boolean;
};

function PendingFeedback({
  group,
  hasFinance,
  placement,
  students,
  documents,
  contracts,
  renewals,
  appointments,
  occurrences,
  health,
  lessons,
  loading,
  financeUnavailable,
}: PendingFeedbackProps): ReactElement {
  const empty = pendingIsEmpty({
    group,
    hasFinance,
    placement,
    students,
    documents,
    contracts,
    renewals,
    appointments,
    occurrences,
    health,
    lessons,
  });
  return (
    <>
      <PendingLessonFeedback lessons={lessons} />
      {empty && (
        <tr>
          <td className={styles.empty}>
            <Inbox aria-hidden="true" />
            <p>{loading ? "Carregando pendências…" : "Nenhuma pendência neste período."}</p>
          </td>
        </tr>
      )}
      {financeUnavailable && (
        <tr>
          <td className={styles.feedback}>Financeiro indisponível no momento.</td>
        </tr>
      )}
    </>
  );
}

function pendingIsEmpty({
  group,
  hasFinance,
  placement,
  students,
  documents,
  contracts,
  renewals,
  appointments,
  occurrences,
  health,
  lessons,
}: Pick<
  PendingFeedbackProps,
  | "group"
  | "hasFinance"
  | "placement"
  | "students"
  | "documents"
  | "contracts"
  | "renewals"
  | "health"
  | "occurrences"
  | "appointments"
  | "lessons"
>): boolean {
  const totals = [
    group,
    placement,
    students,
    documents,
    contracts,
    renewals,
    health,
    occurrences,
    appointments,
  ].map((item) => item?.total);
  totals.push(appointments?.historyTotal, Number(hasFinance));
  return !totals.some(Boolean) && lessons.success && lessons.teachers.length === 0;
}

function PendingLessonFeedback({ lessons }: { lessons: PendingLessonState }): ReactElement {
  return (
    <>
      {lessons.pending && (
        <tr>
          <td className={styles.feedback} role="status">
            Carregando aulas sem registro…
          </td>
        </tr>
      )}
      {lessons.error && (
        <tr>
          <td className={styles.feedback}>
            Não foi possível atualizar as aulas sem registro.{" "}
            <button type="button" onClick={lessons.retry}>
              Tentar novamente
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
