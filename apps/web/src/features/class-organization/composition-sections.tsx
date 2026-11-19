"use client";
import { useState, type JSX as ReactJSX } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarClock,
  CalendarPlus,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { type ClassPlan, type OrganizationAction } from "./model";

import styles from "./formation.module.css";

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
      <PopoverContent align="end" size="menu">
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
    <div className={styles.menuItems}>
      {!ended && plan.active && !plan.classId && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction({ kind: "planStatus", plan, open: true })}
        >
          <CalendarPlus /> Abrir turma
        </Button>
      )}
      {plan.classId ? (
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/turmas/${plan.classId}`} />}
        >
          <ExternalLink /> Ver cadastro da turma
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={ended}
          onClick={() => onAction({ kind: "plan", plan })}
        >
          <Pencil /> Editar horário e professor
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={ended}
        onClick={() => onAction({ kind: "findStudent" })}
      >
        <UserPlus /> Adicionar aluno
      </Button>
      {plan.active && !ended && (
        <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "postpone", plan })}>
          <CalendarClock /> Adiar início
        </Button>
      )}
      {plan.active && plan.classId ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={ended}
          nativeButton={false}
          render={<Link href={`/turmas/${plan.classId}?acao=desfazer`} />}
        >
          <Archive /> Desfazer turma
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={ended}
          onClick={() => onAction({ kind: "planStatus", plan, open: !plan.active })}
        >
          {plan.active ? <Archive /> : <RotateCcw />}
          {plan.active ? "Desfazer turma" : "Reabrir turma"}
        </Button>
      )}
    </div>
  );
}
