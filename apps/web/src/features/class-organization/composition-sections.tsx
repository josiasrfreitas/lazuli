"use client";
import { useState, type JSX as ReactJSX } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { type ClassPlan, type OrganizationAction, type Placement } from "./model";
import styles from "./organization.module.css";

type ActionHandler = (action: OrganizationAction) => void;

export function CompositionMenu({
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
  if (ended || !plan.active || (plan.classId && ready.length === 0)) return null;
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
          ? "Aplicando…"
          : `Aplicar ${ready.length} ${ready.length === 1 ? "alocação" : "alocações"}`}
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
