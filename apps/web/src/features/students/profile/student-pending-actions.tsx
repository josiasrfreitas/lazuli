"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { ArrowRight, CircleCheck, FilePenLine, FileText, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { NewStudentDialog, type IntakeStep } from "../new-student/new-student-dialog";
import type { useStudentPedagogy } from "./logic";
import styles from "./student-pending.module.css";

type PendingAction = RouterOutputs["students"]["pendingActions"]["items"][number];
type Intent = RouterOutputs["semesterOrganization"]["studentIntent"];
type Props = {
  studentId: string;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
};

export function StudentPendingActions({ studentId, pedagogy }: Props): ReactElement {
  const query = trpc.students.pendingActions.useQuery({ id: studentId });
  const intentions = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  const [step, setStep] = useState<IntakeStep | null>(null);
  const [createContract, setCreateContract] = useQueryState("criarContrato");
  const utils = trpc.useUtils();
  const ready = [query.data, intentions.data, pedagogy.data].every(Boolean);
  const failed = [query.isError, intentions.isError, pedagogy.isError].some(Boolean);
  const { items, proposals, count, requestedContract } = pendingContent({
    items: query.data?.items,
    enrollments: pedagogy.data?.enrollments.length,
    intentions: intentions.data,
    ready,
    createContract,
  });
  const closeIntake = (): void => {
    setStep(null);
    void setCreateContract(null);
  };
  const refresh = (): void => {
    closeIntake();
    void Promise.all([
      utils.students.invalidate(),
      utils.finance.invalidate(),
      utils.semesterOrganization.invalidate(),
      utils.dashboard.invalidate(),
    ]);
  };
  return (
    <section className={styles.panel} aria-labelledby="student-pending-title">
      <PendingHeader count={count} ready={ready} />
      <PendingFeedback
        ready={ready}
        failed={failed}
        empty={count === 0}
        retry={() => void Promise.all([query.refetch(), intentions.refetch(), pedagogy.refetch()])}
      />
      <PendingActionList items={items} proposals={proposals} onContinue={setStep} />
      <NewStudentDialog
        open={step !== null || requestedContract}
        initialStep={step ?? (requestedContract ? "contract" : "student")}
        existingStudentId={studentId}
        onOpenChange={(open) => {
          if (!open) closeIntake();
        }}
        onCreated={refresh}
      />
    </section>
  );
}

function PendingHeader({ count, ready }: { count: number; ready: boolean }): ReactElement {
  return (
    <header className={styles.heading}>
      <h2 id="student-pending-title">Pendências</h2>
      {ready && count > 0 && <span>{count}</span>}
    </header>
  );
}

function pendingContent({
  items,
  enrollments,
  intentions,
  ready,
  createContract,
}: {
  items: PendingAction[] | undefined;
  enrollments: number | undefined;
  intentions: Intent | undefined;
  ready: boolean;
  createContract: string | null;
}): {
  items: PendingAction[];
  proposals: Intent;
  count: number;
  requestedContract: boolean;
} {
  const visible = visibleActions(items ?? [], enrollments ?? 0, intentions ?? []);
  const proposals = (intentions ?? []).filter(
    ({ placement }) => !placement.publishedAt && !placement.declinedAt && placement.plan,
  );
  return {
    items: visible,
    proposals,
    count: visible.length + proposals.length,
    requestedContract:
      ready && createContract === "1" && visible.some((item) => item.type === "CONTRACT"),
  };
}

export function visibleActions(
  items: PendingAction[],
  ...[enrollments, intentions]: [number, Intent]
): PendingAction[] {
  const hasDestination =
    enrollments > 0 || intentions.some(({ placement }) => !placement.declinedAt && placement.plan);
  const hasPlacement = items.some((item) => item.type === "PLACEMENT");
  return items.filter(
    (item) =>
      (item.type === "CONTRACT" || !hasDestination) &&
      !(item.type === "CLASS_ALLOCATION" && (hasPlacement || item.blockedBy.length > 0)),
  );
}

function PendingActionList({
  items,
  proposals,
  onContinue,
}: {
  items: PendingAction[];
  proposals: Intent;
  onContinue: (step: IntakeStep) => void;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <RegistrationWork item={item} onContinue={onContinue} />
        </li>
      ))}
      {proposals.map(({ semester, placement }) => (
        <li key={placement.id}>
          <WorkRow
            icon={UsersRound}
            title="Confirmar turma proposta"
            detail={`${placement.plan?.name} · ${semester.name}`}
            action="Ver proposta"
            href={`/organizacao?semestre=${semester.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

function RegistrationWork({
  item,
  onContinue,
}: {
  item: PendingAction;
  onContinue: (step: IntakeStep) => void;
}): ReactElement {
  if (item.action.type === "OPEN_LEAD")
    return (
      <WorkRow
        icon={FilePenLine}
        title={item.title}
        detail="Defina o estágio antes de escolher a turma"
        action={item.action.label}
        href={`/interessados/${item.action.resourceId}`}
      />
    );
  const allocation = item.type === "CLASS_ALLOCATION";
  return (
    <WorkRow
      icon={allocation ? UsersRound : FileText}
      title={allocation ? "Definir primeira turma" : "Criar primeiro contrato"}
      detail={registrationDetail(allocation, item.blockedBy.length > 0)}
      action={allocation ? "Definir turma" : "Criar contrato"}
      disabled={item.blockedBy.length > 0}
      onClick={() => onContinue(allocation ? "pedagogy" : "contract")}
    />
  );
}

function registrationDetail(allocation: boolean, blocked: boolean): string {
  if (!allocation) return "Condições comerciais não registradas";
  return blocked ? "Aguardando o resultado do nivelamento" : "Entrada do aluno ainda sem destino";
}

type WorkRowProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  action: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  warning?: boolean;
};
function WorkRow({
  icon: Icon,
  title,
  detail,
  action,
  href,
  onClick,
  disabled,
  warning,
}: WorkRowProps): ReactElement {
  const content = (
    <>
      <span className={styles.icon} data-warning={warning}>
        <Icon aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <span className={styles.action} aria-hidden="true">
        <ArrowRight aria-hidden="true" />
      </span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={styles.row} title={action}>
        {content}
      </Link>
    );
  return (
    <button
      type="button"
      className={styles.row}
      title={action}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function PendingFeedback({
  ready,
  failed,
  empty,
  retry,
}: {
  ready: boolean;
  failed: boolean;
  empty: boolean;
  retry: () => void;
}): ReactElement | null {
  if (failed)
    return (
      <div className={styles.feedback} role="alert">
        <p>Não foi possível atualizar todas as pendências.</p>
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    );
  if (!ready)
    return (
      <p className={styles.feedback} role="status">
        Conferindo pendências…
      </p>
    );
  if (!empty) return null;
  return (
    <div className={styles.empty}>
      <CircleCheck aria-hidden="true" />
      <h3>Nada pendente por aqui</h3>
      <p>Tudo certo com a entrada e a turma do aluno.</p>
    </div>
  );
}
