"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Info, SlidersHorizontal, UserRoundPlus } from "lucide-react";
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateOnly, useOrganizationRefresh } from "./shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  contractLabel,
  stageLabel,
  type OrganizationAction,
  type Placement,
  type OrganizationBoard,
} from "./model";
import {
  confirmationExplanation,
  confirmationLabels,
  confirmationVariants,
  isConfirmed,
} from "./confirmation";
import styles from "./roster.module.css";

type Props = {
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
  board: OrganizationBoard;
  ended: boolean;
  onAction: (action: OrganizationAction) => void;
  tools: ReactNode;
};

export function ClassRoster({ rows, leads, board, ended, onAction, tools }: Props): ReactElement {
  const pending = rows.filter((row) => row.confirmation === "PENDING");
  const confirmed = rows.filter(isConfirmed);
  const following = rows.filter(
    (row) => row.confirmation === "CHANGING" || row.confirmation === "LEAVING",
  );
  return (
    <div className={styles.layout}>
      <section className={styles.students} aria-label="Continuidade dos alunos">
        <div className={styles.heading}>
          <h3>
            Alunos da turma <span>{rows.length}</span>
          </h3>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Sobre a confirmação de continuidade"
                />
              }
            >
              <Info aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              {confirmationExplanation} Pré-confirmados têm contrato cobrindo os três primeiros
              meses deste período.
            </TooltipContent>
          </Tooltip>
          <div className={styles.tools}>{tools}</div>
        </div>
        <StudentGroup title="A confirmar" rows={pending} ended={ended} onAction={onAction} />
        <StudentGroup title="Confirmados" rows={confirmed} ended={ended} onAction={onAction} />
        <StudentGroup
          title="Acompanhar troca ou saída"
          rows={following}
          ended={ended}
          onAction={onAction}
        />
        {!rows.length && (
          <div className={styles.empty}>
            <p>A turma ainda não tem alunos.</p>
            <Button
              size="sm"
              variant="secondary"
              disabled={ended}
              onClick={() => onAction({ kind: "findStudent" })}
            >
              <UserRoundPlus aria-hidden="true" /> Incluir aluno existente
            </Button>
          </div>
        )}
      </section>
      <InterestedLeads leads={leads} board={board} />
    </div>
  );
}

function StudentGroup({
  title,
  rows,
  ended,
  onAction,
}: {
  title: string;
  rows: Placement[];
  ended: boolean;
  onAction: Props["onAction"];
}): ReactElement | null {
  if (!rows.length) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h4>
        {title} <span>{rows.length}</span>
      </h4>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.id} className={styles.student}>
            <div className={styles.identity}>
              <Link href={`/alunos/${row.studentId}`}>{row.studentName}</Link>
              <div className={styles.context}>
                <span>{stageLabel(row.stageCode)}</span>
                <ContractLink row={row} />
              </div>
            </div>
            <div className={styles.actions}>
              <Badge variant={confirmationVariants[row.confirmation]}>
                {confirmationLabels[row.confirmation]}
              </Badge>
              {row.confirmation === "PENDING" && <ConfirmStudent row={row} ended={ended} />}
              <Button
                size="compact-responsive"
                variant="secondary"
                disabled={ended}
                aria-label={`Revisar continuidade de ${row.studentName}`}
                onClick={() => onAction({ kind: "continuity", row })}
              >
                <SlidersHorizontal aria-hidden="true" /> Revisar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfirmStudent({ row, ended }: { row: Placement; ended: boolean }): ReactElement {
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.continuity.useMutation({ onSuccess: refresh });
  return (
    <div className={styles.confirm}>
      <Button
        size="compact-responsive"
        variant="primary"
        disabled={ended}
        loading={mutation.isPending}
        aria-label={`Confirmar continuidade de ${row.studentName}`}
        onClick={() =>
          mutation.mutate({
            semesterId: row.semesterId,
            id: row.id,
            version: row.version,
            continuity: "STAY",
            reason: "",
          })
        }
      >
        <Check aria-hidden="true" /> Confirmar
      </Button>
      {mutation.error && (
        <p role="alert" className="text-caption text-destructive">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}

function ContractLink({ row }: { row: Placement }): ReactElement {
  const contract = contractLabel(row);
  const renewal = row.contract ?? row.lastContract;
  if (!contract.warning) return <span>{contract.label}</span>;
  const href = `/alunos/${row.studentId}?secao=financeiro${renewal ? `&renovarContrato=${renewal.id}` : ""}`;
  return <Link href={href}>{contract.label}</Link>;
}

function InterestedLeads({ leads, board }: Pick<Props, "leads" | "board">): ReactElement {
  const today = toDateOnlySaoPaulo(new Date());
  const current =
    dateOnly(board.semester.startDate) <= today && dateOnly(board.semester.endDate) >= today;
  return (
    <section className={styles.leads} aria-label="Leads interessados">
      <div className={styles.heading}>
        <h3>
          Leads interessados <span>{leads.length}</span>
        </h3>
      </div>
      {!leads.length ? (
        <p className={styles.emptyNote}>Nenhum interesse vinculado a esta turma.</p>
      ) : (
        <>
          <p className={styles.emptyNote}>
            {current
              ? "Prontos para concluir a entrada pelo lead."
              : "Aguardam o início do período para concluir a entrada."}
          </p>
          <ul className={styles.list}>
            {leads.map((lead) => (
              <li key={lead.id} className={styles.lead}>
                <div className={styles.identity}>
                  <strong>{lead.fullName}</strong>
                  <span>{lead.allocationPendingReason}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={`/interessados/${lead.id}`} />}
                >
                  {current ? "Concluir entrada" : "Ver lead"} <ArrowUpRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
