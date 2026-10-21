"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import {
  dateOnly,
  scheduleLabel,
  useOrganizationRefresh,
} from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  continuityLabel,
  leavingFor,
  rowsFor,
  occupancy,
  stageLabel,
  type ClassPlan,
  type OrganizationAction,
  type SemesterBoard,
} from "./model";
import styles from "./organization.module.css";

export function Composition({
  plan,
  board,
  onBack,
  onAction,
  onFeedback,
}: {
  plan: ClassPlan;
  board: SemesterBoard;
  onBack: () => void;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (message: string) => void;
}): ReactJSX.Element {
  const rows = rowsFor(board, plan.id);
  const health = occupancy(plan);
  const leaving = leavingFor(board, plan);
  const leads = board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id);
  const ready = rows.filter(
    (row) => !row.publishedAt && row.blockers.length === 0 && row.continuity !== "LEAVING",
  );
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const refresh = useOrganizationRefresh();
  const publish = trpc.semesterOrganization.publish.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `${result.count} ${result.count === 1 ? "alocação confirmada" : "alocações confirmadas"}.`,
      );
    },
  });
  return (
    <aside className={styles.panel} aria-label={`Alunos de ${plan.name}`}>
      <header className={styles.panelHeader}>
        <div className={styles.row}>
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} /> Pendências
          </Button>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              render={<Button size="sm" variant="ghost" aria-label="Opções da turma" />}
            >
              <MoreHorizontal size={16} />
            </PopoverTrigger>
            <PopoverContent align="end" size="md">
              <div className="grid gap-2">
                {plan.classId ? (
                  <Link className="text-caption text-interactive" href={`/turmas/${plan.classId}`}>
                    Ver cadastro da turma
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ended}
                    onClick={() => {
                      setMenuOpen(false);
                      onAction({ kind: "plan", plan });
                    }}
                  >
                    Editar horário e professor
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ended}
                  onClick={() => {
                    setMenuOpen(false);
                    onAction({ kind: "findStudent" });
                  }}
                >
                  Adicionar aluno
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ended}
                  onClick={() => {
                    setMenuOpen(false);
                    onAction({ kind: "planStatus", plan, open: !plan.active });
                  }}
                >
                  {plan.active ? "Encerrar turma" : "Reabrir turma"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <h2>{plan.name}</h2>
        <p className={styles.small}>
          {plan.scheduleType === "PERSONALIZED"
            ? "Estágios individuais"
            : stageLabel(plan.stageCode)}{" "}
          · {scheduleLabel(plan.slots)}
        </p>
        <p className={styles.small}>
          {plan.teacherName ?? "Professor a definir"} ·{" "}
          {plan.format === "ONLINE" ? "Online" : "Presencial"} ·{" "}
          {plan.active ? (plan.classId ? `${health.count} alunos` : "Em formação") : "Encerrada"}
        </p>
        {plan.active && (
          <Badge variant={health.tone}>
            {health.count} alunos · {health.label}
          </Badge>
        )}
      </header>
      {leaving.length > 0 && (
        <div className={styles.note}>
          <strong>
            {leaving.length} {leaving.length === 1 ? "possível saída" : "possíveis saídas"}
          </strong>
          <p>
            {leaving.length >= Math.ceil(rows.length / 2)
              ? "A continuidade desta turma precisa de atenção."
              : "Converse com os alunos antes de definir a continuidade."}
          </p>
        </div>
      )}
      <div className={styles.scroll}>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={styles.queueItem}
            disabled={ended}
            onClick={() =>
              onAction(
                row.publishedAt || row.sourceClassId
                  ? { kind: "continuity", row }
                  : { kind: "placement", studentId: row.studentId, row },
              )
            }
          >
            <span className={styles.person}>
              <strong>{row.studentName}</strong>
              <Badge variant="neutral">Aluno da escola</Badge>
              <span
                className={`${styles.small} ${row.continuity === "LEAVING" ? styles.attention : ""}`}
              >
                {stageLabel(row.stageCode)} ·{" "}
                {row.publishedAt || row.sourceClassId
                  ? continuityLabel(row, board)
                  : "Nova entrada"}
              </span>
              {!row.publishedAt && (
                <span className={styles.small}>
                  {row.blockers.length > 0 ? "Alocação a revisar" : "Pronto para confirmar"}
                </span>
              )}
            </span>
            <ChevronRight size={14} />
          </button>
        ))}
        {leads.map((lead) => (
          <Link key={lead.id} href={`/interessados/${lead.id}`} className={styles.queueItem}>
            <span className={styles.person}>
              <strong>{lead.fullName}</strong>
              <span className={styles.queueMeta}>
                <Badge variant="info">Lead</Badge>
                <span className={styles.small}>Finalizar matrícula</span>
              </span>
            </span>
            <ChevronRight size={14} />
          </Link>
        ))}
        {rows.length === 0 && leads.length === 0 && (
          <div className={styles.empty}>
            <h3>A turma está pronta para receber alunos</h3>
            <p>Escolha uma pessoa nas pendências ou adicione um aluno.</p>
            <Button size="sm" variant="secondary" onClick={onBack}>
              Ver pendências
            </Button>
          </div>
        )}
      </div>
      {publish.error && (
        <p role="alert" className={styles.error}>
          {publish.error.message}
        </p>
      )}
      {!ended && plan.active && (
        <footer className={styles.selection}>
          {ready.length > 0 ? (
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate({
                  planId: plan.id,
                  version: plan.version,
                  placements: ready.map(({ id, version }) => ({ id, version })),
                })
              }
            >
              {publish.isPending
                ? "Confirmando…"
                : `Confirmar ${ready.length} ${ready.length === 1 ? "alocação" : "alocações"}`}
            </Button>
          ) : plan.classId ? (
            <p className={styles.small}>
              Selecione um aluno para registrar continuidade, troca ou possível saída.
            </p>
          ) : (
            <Button size="sm" onClick={() => onAction({ kind: "planStatus", plan, open: true })}>
              Abrir turma
            </Button>
          )}
        </footer>
      )}
    </aside>
  );
}
