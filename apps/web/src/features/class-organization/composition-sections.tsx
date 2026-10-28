"use client";
import { useState, type JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { scheduleLabel } from "~/features/semester-organization/shared";
import {
  continuityLabel,
  occupancy,
  stageLabel,
  type ClassPlan,
  type OrganizationAction,
  type Placement,
  type SemesterBoard,
} from "./model";
import styles from "./organization.module.css";

type ActionHandler = (action: OrganizationAction) => void;
type Lead = SemesterBoard["waitingLeads"][number];

export function CompositionHeader({
  plan,
  ended,
  onBack,
  onAction,
}: {
  plan: ClassPlan;
  ended: boolean;
  onBack: () => void;
  onAction: ActionHandler;
}): ReactJSX.Element {
  const health = occupancy(plan);
  return (
    <header className={styles.panelHeader}>
      <div className={styles.row}>
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Pendências
        </Button>
        <CompositionMenu plan={plan} ended={ended} onAction={onAction} />
      </div>
      <h2>{plan.name}</h2>
      <p className={styles.small}>
        {plan.scheduleType === "PERSONALIZED" ? "Estágios individuais" : stageLabel(plan.stageCode)}{" "}
        · {scheduleLabel(plan.slots)}
      </p>
      <p className={styles.small}>
        {plan.teacherName ?? "Professor a definir"} ·{" "}
        {plan.format === "ONLINE" ? "Online" : "Presencial"} · {planActivity(plan, health.count)}
      </p>
      {!plan.teacherName && !plan.classId && !ended && (
        <Button size="sm" onClick={() => onAction({ kind: "plan", plan })}>
          Definir professor
        </Button>
      )}
      {plan.active && (
        <Badge variant={health.tone}>
          {health.count} alunos · {health.label}
        </Badge>
      )}
    </header>
  );
}

function CompositionMenu({
  plan,
  ended,
  onAction,
}: {
  plan: ClassPlan;
  ended: boolean;
  onAction: ActionHandler;
}): ReactJSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const act = (action: OrganizationAction): void => {
    setMenuOpen(false);
    onAction(action);
  };
  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger render={<Button size="sm" variant="ghost" aria-label="Opções da turma" />}>
        <MoreHorizontal size={16} />
      </PopoverTrigger>
      <PopoverContent align="end" size="md">
        <CompositionMenuItems plan={plan} ended={ended} onAction={act} />
      </PopoverContent>
    </Popover>
  );
}

function CompositionMenuItems({
  plan,
  ended,
  onAction,
}: {
  plan: ClassPlan;
  ended: boolean;
  onAction: ActionHandler;
}): ReactJSX.Element {
  return (
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
          onClick={() => onAction({ kind: "plan", plan })}
        >
          Editar horário e professor
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={ended}
        onClick={() => onAction({ kind: "findStudent" })}
      >
        Adicionar aluno
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={ended}
        onClick={() => onAction({ kind: "planStatus", plan, open: !plan.active })}
      >
        {plan.active ? "Encerrar turma" : "Reabrir turma"}
      </Button>
    </div>
  );
}

function planActivity(plan: ClassPlan, count: number): string {
  if (!plan.active) return "Encerrada";
  return plan.classId ? `${count} alunos` : "Em formação";
}

export function LeavingNote({
  leaving,
  total,
}: {
  leaving: number;
  total: number;
}): ReactJSX.Element | null {
  if (leaving === 0) return null;
  return (
    <div className={styles.note}>
      <strong>
        {leaving} {leaving === 1 ? "possível saída" : "possíveis saídas"}
      </strong>
      <p>
        {leaving >= Math.ceil(total / 2)
          ? "A continuidade desta turma precisa de atenção."
          : "Converse com os alunos antes de definir a continuidade."}
      </p>
    </div>
  );
}

export function CompositionList({
  rows,
  leads,
  board,
  ended,
  onBack,
  onAction,
}: {
  rows: Placement[];
  leads: Lead[];
  board: SemesterBoard;
  ended: boolean;
  onBack: () => void;
  onAction: ActionHandler;
}): ReactJSX.Element {
  return (
    <div className={styles.scroll}>
      {rows.map((row) => (
        <StudentRow key={row.id} row={row} board={board} ended={ended} onAction={onAction} />
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
  );
}

function StudentRow({
  row,
  board,
  ended,
  onAction,
}: {
  row: Placement;
  board: SemesterBoard;
  ended: boolean;
  onAction: ActionHandler;
}): ReactJSX.Element {
  const action: OrganizationAction =
    row.publishedAt || row.sourceClassId
      ? { kind: "continuity", row }
      : { kind: "placement", studentId: row.studentId, row };
  return (
    <button
      type="button"
      className={styles.queueItem}
      disabled={ended}
      onClick={() => onAction(action)}
    >
      <span className={styles.person}>
        <strong>{row.studentName}</strong>
        <Badge variant="neutral">Aluno da escola</Badge>
        <span className={`${styles.small} ${row.continuity === "LEAVING" ? styles.attention : ""}`}>
          {stageLabel(row.stageCode)} ·{" "}
          {row.publishedAt || row.sourceClassId ? continuityLabel(row, board) : "Nova entrada"}
        </span>
        {!row.publishedAt && (
          <span className={styles.small}>
            {row.blockers.length > 0 ? "Alocação a revisar" : "Pronto para confirmar"}
          </span>
        )}
      </span>
      <ChevronRight size={14} />
    </button>
  );
}

export function CompositionFooter({
  plan,
  ready,
  ended,
  pending,
  onPublish,
  onAction,
}: {
  plan: ClassPlan;
  ready: Placement[];
  ended: boolean;
  pending: boolean;
  onPublish: () => void;
  onAction: ActionHandler;
}): ReactJSX.Element | null {
  if (ended || !plan.active) return null;
  return (
    <footer className={styles.selection}>
      <CompositionFooterContent
        plan={plan}
        ready={ready}
        pending={pending}
        onPublish={onPublish}
        onAction={onAction}
      />
    </footer>
  );
}

function CompositionFooterContent({
  plan,
  ready,
  pending,
  onPublish,
  onAction,
}: {
  plan: ClassPlan;
  ready: Placement[];
  pending: boolean;
  onPublish: () => void;
  onAction: ActionHandler;
}): ReactJSX.Element {
  if (ready.length > 0) {
    return (
      <Button size="sm" disabled={pending} onClick={onPublish}>
        {pending
          ? "Confirmando…"
          : `Confirmar ${ready.length} ${ready.length === 1 ? "alocação" : "alocações"}`}
      </Button>
    );
  }
  if (plan.classId) {
    return (
      <p className={styles.small}>
        Selecione um aluno para registrar continuidade, troca ou possível saída.
      </p>
    );
  }
  return (
    <Button size="sm" onClick={() => onAction({ kind: "planStatus", plan, open: true })}>
      Abrir turma
    </Button>
  );
}
