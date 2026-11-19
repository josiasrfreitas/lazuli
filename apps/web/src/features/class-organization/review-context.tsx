"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, ClipboardList, TriangleAlert } from "lucide-react";
import { LOW_HEALTH_SCORE } from "@lazuli/domain";
import { Alert, AlertContent, AlertIcon, AlertTitle, Button } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { reviewBlockers } from "./review-model";
import type { ClassPlan, OrganizationAction, Placement } from "./model";
import styles from "./review-detail.module.css";

const score = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function ReviewMetrics({ row }: { row: Placement }): ReactElement {
  const health = trpc.students.health.useQuery({ id: row.studentId }, { staleTime: 60_000 });
  const value = health.data?.score ?? row.attention.healthScore;
  const { attendance, attendanceFlagged, gradeAverage, grades } = row.attention;
  return (
    <section className={styles.academic}>
      <h2 className={styles.sectionTitle}>
        <Activity size={17} aria-hidden="true" /> Situação do aluno
      </h2>
      <dl className={styles.metrics}>
        <Metric
          label="Saúde do vínculo"
          value={value}
          fallback={healthLabel(health.isPending, health.isError)}
          flag={value !== null && value < LOW_HEALTH_SCORE ? "Requer atenção" : undefined}
        />
        <Metric
          label="Média no estágio"
          value={gradeAverage}
          fallback="Sem notas"
          flag={grades === "NEEDS_SUPPORT" ? "Média baixa" : undefined}
        />
        <Metric
          label="Presença"
          value={attendance}
          format={formatAttendancePercent}
          fallback="Sem registros"
          flag={attendanceFlagged ? "Baixa" : undefined}
        />
      </dl>
    </section>
  );
}

function healthLabel(pending: boolean, failed: boolean): string {
  if (pending) return "Carregando…";
  return failed ? "Indisponível" : "Sem dados";
}

function Metric({
  label,
  value,
  fallback,
  flag,
  format = (value) => score.format(value),
}: {
  label: string;
  value: number | null;
  format?: (value: number) => string;
  fallback: string;
  flag?: string | undefined;
}): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-missing={value === null || undefined} data-flagged={Boolean(flag) || undefined}>
        {value === null ? fallback : format(value)}
        {flag && (
          <span className={styles.metricFlag}>
            <TriangleAlert size={12} aria-hidden="true" /> {flag}
          </span>
        )}
      </dd>
    </div>
  );
}

export function ReviewPending({
  row,
  historical,
  plan,
  onAction,
}: {
  row: Placement;
  historical: boolean;
  plan: ClassPlan | undefined;
  onAction: (action: OrganizationAction) => void;
}): ReactElement | null {
  if (row.declinedAt) return null;
  const blockers = reviewBlockers(row);
  if (blockers.length === 0) return null;
  const pendingLabel = row.publishedAt ? "Pendências da alocação" : "Antes de alocar";
  const heading = historical ? "Impedimentos na consulta" : pendingLabel;
  return (
    <Alert variant="warning" role="note">
      <AlertIcon>
        <ClipboardList />
      </AlertIcon>
      <AlertContent>
        <AlertTitle>{heading}</AlertTitle>
        <ul className={styles.blockers}>
          {blockers.map((reason) => (
            <li key={reason}>
              {reason}
              {reason === "Contrato termina na primeira metade do período" &&
                row.attention.coverageThrough && (
                  <span className={styles.evidence}>
                    Cobertura até {formatDateOnlyBR(row.attention.coverageThrough)}
                  </span>
                )}
              {!historical &&
                plan &&
                row.continuity !== "LEAVING" &&
                reason === "Professor pendente na data de entrada" &&
                (plan.classId ? (
                  <Button
                    size="compact-responsive"
                    variant="link"
                    nativeButton={false}
                    render={<Link href={`/turmas/${plan.classId}?acao=professor`} />}
                  >
                    Atribuir professor <ArrowUpRight />
                  </Button>
                ) : (
                  <Button
                    size="compact-responsive"
                    variant="link"
                    onClick={() => onAction({ kind: "plan", plan })}
                  >
                    Editar professor da turma
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      </AlertContent>
    </Alert>
  );
}

export type ProfileLinks = {
  profile: (params: Record<string, string>) => string;
  requested: (task: string) => string;
};
type ReviewLink = { label: string; href: string };

function contractAction(
  row: Placement,
  { profile, renewalId }: { profile: ProfileLinks["profile"]; renewalId: string | undefined },
): ReviewLink | null {
  if (renewalId)
    return {
      label: "Rematricular",
      href: profile({ secao: "financeiro", renovarContrato: renewalId }),
    };
  if (row.attention.contractStatus === "COVERED") return null;
  return row.lastContract || row.upcomingContract || row.contract
    ? { label: "Conferir contrato", href: profile({ secao: "financeiro", detalhesContrato: "1" }) }
    : { label: "Cadastrar contrato", href: profile({ criarContrato: "1" }) };
}

const academicDecisions = new Set([
  "Aprovação pedagógica pendente",
  "Confirmação de repetência pendente",
  "O plano ou a avaliação PPT mudou após a publicação",
]);

function followUpLinks(row: Placement, { profile, requested }: ProfileLinks): ReviewLink[] {
  const links: ReviewLink[] = [];
  if (
    row.sourceProgressId &&
    (row.attention.grades !== "SUFFICIENT" ||
      row.blockers.some((reason) => academicDecisions.has(reason)))
  )
    links.push({ label: "Revisar notas", href: requested("notas") });
  if (
    row.sourceEnrollmentId &&
    (row.attention.attendanceFlagged || row.attention.attendance === null)
  )
    links.push({ label: "Conferir chamadas", href: requested("presenca") });
  if (row.attention.materialMissing && (row.contract || row.lastContract))
    links.push({
      label: "Conferir material",
      href: profile({ secao: "financeiro", material: "1" }),
    });
  return links;
}

export function useReviewContractLink(
  row: Placement,
  { links, enabled }: { links: ProfileLinks; enabled: boolean },
): ReviewLink | null {
  const summary = trpc.finance.studentSummary.useQuery(
    { studentId: row.studentId },
    {
      enabled: enabled && row.attention.contractStatus !== "COVERED" && Boolean(row.lastContract),
      staleTime: 60_000,
    },
  );
  const renewal = summary.data?.pendingRenewals.find((item) => item.id === row.lastContract?.id);
  return contractAction(row, { profile: links.profile, renewalId: renewal?.id });
}

export function ReviewFollowUps({
  row,
  links,
  task,
}: {
  row: Placement;
  links: ProfileLinks;
  task: "turma" | "decisao" | "historico";
}): ReactElement {
  const historical = task === "historico";
  const financial = useReviewContractLink(row, { links, enabled: !historical });
  const actions = historical ? [] : profileActions(row, { links, financial });
  const profileLabel = historical ? "Ver histórico no perfil" : "Abrir perfil";
  return (
    <section className={styles.followUps}>
      {actions.length > 0 && <h2 className={styles.sectionTitle}>No perfil do aluno</h2>}
      <div className={styles.profileLinks}>
        {actions.map(({ label, href }) => (
          <Button
            key={label}
            size="compact-responsive"
            variant="info"
            nativeButton={false}
            render={<Link href={href} />}
          >
            {label} <ArrowUpRight />
          </Button>
        ))}
        <Button
          size="compact-responsive"
          variant="link"
          nativeButton={false}
          render={
            <Link
              href={row.confirmation === "PRECONFIRMED" ? links.profile({}) : links.requested(task)}
            />
          }
        >
          {profileLabel} <ArrowUpRight />
        </Button>
      </div>
    </section>
  );
}

function profileActions(
  row: Placement,
  { links, financial }: { links: ProfileLinks; financial: ReviewLink | null },
): ReviewLink[] {
  const actions = followUpLinks(row, links);
  if (financial) actions.unshift(financial);
  else if (row.exitRiskActive || row.continuity === "LEAVING")
    actions.push({ label: "Consultar Financeiro", href: links.profile({ secao: "financeiro" }) });
  return actions;
}
