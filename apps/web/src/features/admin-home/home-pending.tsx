import type { ReactElement } from "react";
import { Inbox } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import type { BusinessData } from "./home-metrics";
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
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  loading: boolean;
  businessLoading: boolean;
  businessError: boolean;
}): ReactElement {
  const lessons = trpc.dashboard.pendingLessons.useQuery(undefined, { refetchInterval: 60_000 });
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
  teachers: RouterOutputs["dashboard"]["pendingLessons"];
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
  return {
    health: data?.groups.find((item) => item.kind === "health"),
    occurrences: data?.groups.find((item) => item.kind === "occurrences"),
    group: data?.groups.find((item) => item.kind === "coverage"),
    appointments: data?.groups.find((item) => item.kind === "appointments"),
    renewals: data?.canViewFinance
      ? data.groups.find((item) => item.kind === "renewals")
      : undefined,
    placement: data?.groups.find((item) => item.kind === "placement"),
    contracts: data?.canViewFinance
      ? data.groups.find((item) => item.kind === "contracts")
      : undefined,
    students: data?.groups.find((item) => item.kind === "students"),
    documents: data?.groups.find((item) => item.kind === "documents"),
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
  return (
    <>
      {hasFinance && business && <PendingFinance business={business} />}
      <PendingOccurrences group={groups.occurrences} />
      <PendingOccurrences group={groups.health} kind="health" />
      <PendingCoverage group={groups.group} today={data?.today ?? ""} />
      {data?.canViewFinance && <PendingRenewals group={groups.renewals} today={data.today} />}
      <PendingAppointments group={groups.appointments} today={data?.today ?? ""} />
      <PendingPlacement group={groups.placement} today={data?.today ?? ""} />
      {data?.canViewFinance && <PendingStudents group={groups.contracts} kind="contracts" />}
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
    group?.total,
    hasFinance,
    placement?.total,
    students?.total,
    documents?.total,
    contracts?.total,
    renewals?.total,
    health?.total,
    occurrences?.total,
    appointments?.total,
    appointments?.historyTotal,
  ];
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
