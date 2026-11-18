"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent, formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { dateOnly, scheduleLabel } from "./shared";
import type { OrganizationAction, OrganizationBoard, Placement } from "./model";
import { HistoryRow } from "./action-dialogs";
import styles from "./review.module.css";

type Props = {
  row: Placement;
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  readOnly?: boolean;
};

const score = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function StudentReviewDetail({ row, board, onAction, readOnly }: Props) {
  const plan = board.plans.find((item) => item.id === row.planId);
  const historical = readOnly || dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const editingClass = Boolean(!row.planId || row.continuity === "CHANGE" || row.publishedAt);
  const action: OrganizationAction = editingClass
    ? row.publishedAt
      ? { kind: "move", rows: [row] }
      : { kind: "placement", row, studentId: row.studentId }
    : { kind: "continuity", row };
  const label = editingClass ? (plan ? "Alterar turma" : "Escolher turma") : "Registrar resposta";
  const base = `/alunos/${row.studentId}`;
  const back = usePathname() + "?" + useSearchParams().toString();
  const profile = (params: Record<string, string>) =>
    base + "?" + new URLSearchParams({ ...params, voltar: back });
  const requested = (task: string) =>
    profile({ revisarVinculo: [board.semester.id, row.id, task].join(":") });
  return (
    <div className={styles.detail}>
      <div className={styles.detailTop}>
        <div className={styles.journey}>
          <div>
            <small>Turma de origem</small>
            <strong>{row.sourceClassName ?? "Primeira matrícula"}</strong>
            <span>
              {[
                row.sourceStageName ?? row.sourceStageCode,
                row.sourceTeacher,
                scheduleLabel(row.sourceSchedule),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <ArrowRight size={16} aria-hidden="true" />
          <div>
            <small>
              {row.publishedAt ? "Turma de destino" : "Turma proposta"} · {board.semester.name}
            </small>
            <strong>
              {row.declinedAt ? "Saída registrada" : (plan?.name ?? "Turma a definir")}
            </strong>
            <span>
              {[
                row.stageName ?? row.stageCode,
                plan?.teacherName,
                plan && scheduleLabel(plan.slots),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
        <ReviewMetrics row={row} />
      </div>
      <div className={styles.detailBottom}>
        <section className={styles.next}>
          <h3>{row.declinedAt || historical ? "Situação do vínculo" : "Próxima ação"}</h3>
          {row.declinedAt ? (
            <p>Saída registrada para este semestre.</p>
          ) : row.blockers.length ? (
            <ul className={styles.blockers}>
              {row.blockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>
              {row.publishedAt
                ? "Alocação confirmada para a data de vigência."
                : "Turma e estágio definidos. Selecione o aluno na revisão para confirmar a alocação."}
            </p>
          )}
          {row.attentionNote && <p>{row.attentionNote}</p>}
          {row.continuityReason && <p>{row.continuityReason}</p>}
          <div className={styles.actions}>
            {!historical && !row.declinedAt && (
              <Button size="sm" variant="secondary" onClick={() => onAction(action)}>
                {label}
              </Button>
            )}
            {!historical && !row.declinedAt && editingClass && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction({ kind: "continuity", row })}
              >
                Registrar resposta
              </Button>
            )}
            {!historical && !row.declinedAt && !editingClass && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction({ kind: "placement", row, studentId: row.studentId })}
              >
                Editar proposta de turma
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={
                <Link
                  href={requested(
                    historical || row.declinedAt ? "historico" : editingClass ? "turma" : "decisao",
                  )}
                />
              }
            >
              {historical || row.declinedAt
                ? "Histórico no perfil"
                : editingClass
                  ? "Escolher turma no perfil"
                  : "Registrar resposta no perfil"}{" "}
              <ArrowUpRight size={14} />
            </Button>
            {!historical && row.entryStatus === "SCHEDULED" && (
              <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "withdraw", row })}>
                Desfazer alocação
              </Button>
            )}
          </div>
          <ReviewProfileActions row={row} profile={profile} requested={requested} />
        </section>
        <ReviewHistory row={row} onAction={onAction} />
      </div>
    </div>
  );
}

function ReviewMetrics({ row }: { row: Placement }) {
  const health = trpc.students.health.useQuery({ id: row.studentId }, { staleTime: 60_000 });
  const value = health.data?.score ?? row.attention.healthScore;
  return (
    <dl className={styles.metrics}>
      <div>
        <dt>Health Score</dt>
        <dd>
          {value != null
            ? score.format(value)
            : health.isPending
              ? "Carregando…"
              : health.isError
                ? "Indisponível"
                : "Sem dados"}
        </dd>
      </div>
      <div>
        <dt>Média no estágio</dt>
        <dd>
          {row.attention.gradeAverage == null
            ? "Sem notas"
            : score.format(row.attention.gradeAverage)}
        </dd>
      </div>
      <div>
        <dt>Presença</dt>
        <dd>
          {row.attention.attendance == null
            ? "Sem registros"
            : formatAttendancePercent(row.attention.attendance)}
        </dd>
      </div>
    </dl>
  );
}

function ReviewProfileActions({
  row,
  profile,
  requested,
}: {
  row: Placement;
  profile: (params: Record<string, string>) => string;
  requested: (task: string) => string;
}) {
  const contractAttention = row.attention.contractStatus !== "COVERED";
  const summary = trpc.finance.studentSummary.useQuery(
    { studentId: row.studentId },
    { enabled: contractAttention && Boolean(row.lastContract), staleTime: 60_000 },
  );
  const renewal = summary.data?.pendingRenewals.find((item) => item.id === row.lastContract?.id);
  const links = [];
  if (renewal) {
    links.push({
      label: "Rematricular",
      href: profile({ secao: "financeiro", renovarContrato: renewal.id }),
    });
  } else if (contractAttention) {
    links.push(
      row.lastContract
        ? {
            label: "Conferir contrato",
            href: profile({ secao: "financeiro", detalhesContrato: "1" }),
          }
        : { label: "Cadastrar contrato", href: profile({ criarContrato: "1" }) },
    );
  }
  if (row.sourceProgressId && row.attention.grades !== "SUFFICIENT")
    links.push({ label: "Revisar notas", href: requested("notas") });
  if (
    row.sourceEnrollmentId &&
    (row.attention.attendanceFlagged || row.attention.attendance == null)
  )
    links.push({ label: "Conferir chamadas", href: requested("presenca") });
  if (row.attention.materialMissing && (row.contract || row.lastContract))
    links.push({
      label: "Conferir material",
      href: profile({ secao: "financeiro", material: "1" }),
    });
  if (!links.length) return null;
  return (
    <div className={styles.profileActions}>
      <small>Resolver no perfil</small>
      <div className={styles.actions}>
        {links.map((link) => (
          <Button
            key={link.label}
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={link.href} />}
          >
            {link.label}
            <ArrowUpRight size={14} />
          </Button>
        ))}
      </div>
    </div>
  );
}

function ReviewHistory({ row, onAction }: Pick<Props, "row" | "onAction">) {
  const history = trpc.semesterOrganization.history.useQuery({ id: row.id });
  const followUp = trpc.interventions.list.useQuery({
    studentId: row.studentId,
    search: "",
    page: 1,
  });
  const lastIntervention = followUp.data?.rows[0];
  return (
    <section className={styles.history}>
      <h3>Histórico deste vínculo</h3>
      {history.isPending ? (
        <p>Carregando histórico…</p>
      ) : history.isError ? (
        <Button variant="link" size="sm" onClick={() => void history.refetch()}>
          Tentar carregar o histórico
        </Button>
      ) : !history.data?.length ? (
        <p>Nenhuma tratativa registrada.</p>
      ) : (
        <ol>
          {history.data.slice(0, 2).map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </ol>
      )}
      {history.data && history.data.length > 2 && (
        <Button size="sm" variant="link" onClick={() => onAction({ kind: "history", row })}>
          Ver histórico completo ({history.data.length})
        </Button>
      )}
      {lastIntervention && (
        <div className={styles.profileActions}>
          <small>Última intervenção pedagógica</small>
          <strong>{lastIntervention.title}</strong>
          <p>
            {formatDateOnlyBR(dateOnly(lastIntervention.performedOn))} ·{" "}
            {lastIntervention.responsible.name}
          </p>
        </div>
      )}
    </section>
  );
}
