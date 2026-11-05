"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import {
  ArrowRight,
  CircleCheck,
  FilePenLine,
  FileText,
  FolderOpen,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { NewStudentDialog, type IntakeStep } from "../new-student/new-student-dialog";
import type { useStudentPedagogy } from "./logic";
import styles from "./student-pending.module.css";

type PendingAction = RouterOutputs["students"]["pendingActions"]["items"][number];
type Intent = RouterOutputs["semesterOrganization"]["studentIntent"];
const DATE_ONLY_LENGTH = 10;
type Props = {
  studentId: string;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
  onNavigate: (section: "cadastro") => void;
};

export function StudentPendingActions({ studentId, pedagogy, onNavigate }: Props): ReactElement {
  const query = trpc.students.pendingActions.useQuery({ id: studentId });
  const intentions = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  const [step, setStep] = useState<IntakeStep | null>(null);
  const [createContract, setCreateContract] = useQueryState("criarContrato");
  const utils = trpc.useUtils();
  const ready = [query.data, intentions.data, pedagogy.data].every(Boolean);
  const failed = [query.isError, intentions.isError, pedagogy.isError].some(Boolean);
  const { items, destinations, count, requestedContract } = pendingContent({
    items: query.data?.items,
    enrollments: pedagogy.data?.enrollments.length,
    intentions: intentions.data,
    today: pedagogy.data?.today,
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
      <PendingActionList
        items={items}
        destinations={destinations}
        nextPeriod={Boolean(query.data?.futurePlacement)}
        onContinue={setStep}
        onNavigate={onNavigate}
      />
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
  today,
  ready,
  createContract,
}: {
  items: PendingAction[] | undefined;
  enrollments: number | undefined;
  intentions: Intent | undefined;
  today: string | undefined;
  ready: boolean;
  createContract: string | null;
}): {
  items: PendingAction[];
  destinations: Intent;
  count: number;
  requestedContract: boolean;
} {
  const visible = visibleActions(items ?? [], enrollments ?? 0, intentions ?? []);
  const destinations = (intentions ?? []).filter(
    ({ semester, placement }) =>
      !placement.declinedAt &&
      placement.plan &&
      (!placement.publishedAt ||
        (today && semester.startDate.toISOString().slice(0, DATE_ONLY_LENGTH) > today)),
  );
  return {
    items: visible,
    destinations,
    count: visible.length + destinations.length,
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
      (item.type === "CONTRACT" || item.type === "DOCUMENTS" || !hasDestination) &&
      !(item.type === "CLASS_ALLOCATION" && (hasPlacement || item.blockedBy.length > 0)),
  );
}

function PendingActionList({
  items,
  destinations,
  nextPeriod,
  onContinue,
  onNavigate,
}: {
  items: PendingAction[];
  destinations: Intent;
  nextPeriod: boolean;
  onContinue: (step: IntakeStep) => void;
  onNavigate: (section: "cadastro") => void;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <RegistrationWork
            item={item}
            nextPeriod={nextPeriod}
            onContinue={onContinue}
            onNavigate={onNavigate}
          />
        </li>
      ))}
      {destinations.map(({ semester, placement }) => (
        <li key={placement.id}>
          <WorkRow
            icon={UsersRound}
            title={placement.publishedAt ? "Nova turma confirmada" : "Confirmar turma proposta"}
            detail={`${placement.plan?.name} · ${semester.name}`}
            action={placement.publishedAt ? "Ver turma" : "Ver proposta"}
            href={`/organizacao?semestre=${semester.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

function RegistrationWork({
  item,
  nextPeriod,
  onContinue,
  onNavigate,
}: {
  item: PendingAction;
  nextPeriod: boolean;
  onContinue: (step: IntakeStep) => void;
  onNavigate: (section: "cadastro") => void;
}): ReactElement {
  if (item.type === "DOCUMENTS")
    return (
      <WorkRow
        icon={FolderOpen}
        title={item.title}
        detail={item.description}
        action={item.action.label}
        onClick={() => onNavigate("cadastro")}
      />
    );
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
      title={registrationTitle({ allocation, nextPeriod })}
      detail={registrationDetail({ allocation, blocked: item.blockedBy.length > 0, nextPeriod })}
      action={allocation ? "Definir turma" : "Criar contrato"}
      disabled={item.blockedBy.length > 0}
      onClick={() => onContinue(allocation ? "pedagogy" : "contract")}
    />
  );
}

function registrationTitle(input: { allocation: boolean; nextPeriod: boolean }): string {
  if (!input.allocation) return "Criar primeiro contrato";
  return input.nextPeriod ? "Definir turma do próximo período" : "Definir primeira turma";
}

function registrationDetail(input: {
  allocation: boolean;
  blocked: boolean;
  nextPeriod: boolean;
}): string {
  const { allocation, blocked, nextPeriod } = input;
  if (!allocation) return "Condições comerciais não registradas";
  if (blocked) return "Aguardando o resultado do nivelamento";
  return nextPeriod ? "Entrada prevista sem turma definida" : "Entrada do aluno ainda sem destino";
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
