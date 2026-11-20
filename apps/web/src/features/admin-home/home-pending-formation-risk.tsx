import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Radar } from "lucide-react";
import { atRisk } from "~/features/class-organization/formation-calendar";
import { resolveSemesterId } from "~/features/class-organization/page-model";
import { dateOnly } from "~/features/class-organization/shared";
import { trpc } from "~/lib/trpc";
import { PendingDisclosure } from "./home-pending-disclosure";
import { PendingIcon } from "./home-pending-icon";
import styles from "./home-pending.module.css";

export function useFormationRisk(today: string | undefined) {
  const periods = trpc.semesterOrganization.semesters.useQuery(undefined, {
    enabled: Boolean(today),
  });
  const semesterId = today
    ? resolveSemesterId({ selectedPeriod: "", periods: periods.data ?? [], today })
    : "";
  const semester = periods.data?.find((period) => period.id === semesterId);
  const board = trpc.semesterOrganization.detail.useQuery(
    { semesterId },
    {
      enabled: Boolean(today && semester && dateOnly(semester.endDate) >= today),
      refetchInterval: 60_000,
    },
  );
  const data = board.data;
  const plans =
    data && today && dateOnly(data.semester.endDate) >= today
      ? data.plans.filter((plan) => atRisk(data, plan))
      : [];
  return {
    plans,
    semesterId,
    failed: periods.isError || board.isError,
    retry: () => void (periods.isError ? periods.refetch() : board.refetch()),
  };
}

export function PendingFormationRisk({
  risk,
}: {
  risk: ReturnType<typeof useFormationRisk>;
}): ReactElement | null {
  const { plans, semesterId, failed, retry } = risk;
  if (plans.length === 0 && !failed) return null;
  return (
    <tr>
      <td className={styles.cell}>
        {failed && (
          <p className={styles.feedback} role="alert">
            Não foi possível atualizar as turmas em risco.{" "}
            <button type="button" onClick={retry}>
              Tentar novamente
            </button>
          </p>
        )}
        {plans.length > 0 && (
          <PendingDisclosure
            summary={
              <>
                <PendingIcon icon={Radar} className={styles.planningIcon} attention />
                <span className={styles.identity}>
                  <strong>{plans.length === 1 ? "Turma em risco" : "Turmas em risco"}</strong>
                  <span>
                    {plans.length} {plans.length === 1 ? "turma" : "turmas"} abaixo do mínimo de
                    alunos previstos
                  </span>
                </span>
                <span className={styles.action}>
                  <ChevronDown aria-hidden="true" />
                </span>
              </>
            }
          >
            <ul className={styles.lessonList}>
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/turmas/formacao?semestre=${semesterId}&turma=${plan.id}`}
                    className={`${styles.appointmentCase} ${styles.planningCase}`}
                  >
                    <strong className={styles.caseName}>{plan.name}</strong>
                    <span className={styles.action}>
                      Ver turma <ArrowRight aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PendingDisclosure>
        )}
      </td>
    </tr>
  );
}
