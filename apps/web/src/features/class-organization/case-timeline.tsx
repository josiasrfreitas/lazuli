"use client";

import { exitRiskReasonLabels } from "@lazuli/validators";
import { useState, type ReactElement } from "react";
import { ArrowUpRight, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { hasFormationSignal } from "@lazuli/domain";
import { CaseForm } from "./case-form";
import { dateOnly, useOrganizationRefresh } from "./shared";
import type { Placement } from "./model";
import type { ProfileLinks } from "./review-context";
import styles from "./review-detail.module.css";

type Event = RouterOutputs["semesterOrganization"]["caseHistory"][number];
const titles: Record<string, string> = {
  RISK: "Risco de saída sinalizado",
  AGREEMENT: "Negociação vinculada",
  CHANGE_REQUEST: "Pedido de troca registrado",
  RETRACT_REQUEST: "Pedido de troca retirado",
  SCHEDULE_RISK: "Risco de troca de horário",
  CLASS_REASSIGNED: "Nova turma definida",
  CLASS_DISSOLVED: "Turma encerrada",
  BLOCK: "Impedimento na turma",
  UNBLOCK: "Impedimento resolvido",
  CONTACT: "Tentativa de contato",
  HANDOFF: "Encaminhamento",
  REVIEW: "Reavaliação do risco",
  NOTE: "Observação da equipe",
  PUBLISHED: "Publicação do vínculo",
};
const outcomes: Record<string, string> = {
  CONTINUES: "O risco continua",
  CHANGED: "O risco mudou",
  RESOLVED: "Risco resolvido",
};
const stamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function CaseTimeline({
  row,
  editable,
  links,
}: {
  row: Placement;
  editable: boolean;
  links: ProfileLinks;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const refresh = useOrganizationRefresh();
  const history = trpc.semesterOrganization.caseHistory.useQuery({ id: row.id });
  const active = hasFormationSignal(row);
  const canRecord = editable && active;
  if (!active && !history.isError && !history.data?.length) return null;
  return (
    <section className={styles.history} aria-label="Acompanhamento da equipe">
      <div className={styles.timelineHeading}>
        <h2 className={styles.sectionTitle}>Acompanhamento da equipe</h2>
        {canRecord && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <MessageSquarePlus />
            Registrar intervenção
          </Button>
        )}
      </div>
      <TimelineEntries history={history} id={row.id} links={links} />
      {canRecord && open && (
        <CaseForm
          id={row.id}
          semesterId={row.semesterId}
          version={row.version}
          hasRequest={row.continuity === "CHANGE"}
          hasRisk={row.exitRiskActive || row.continuity === "LEAVING"}
          description={row.studentName}
          mode="intervention"
          financeHref={links.profile({ secao: "financeiro" })}
          onClose={() => setOpen(false)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

const RECENT_EVENT_COUNT = 3;
type TimelineProps = { id: string; links: ProfileLinks };
function TimelineEntries({
  id,
  links,
  history,
}: TimelineProps & {
  history: {
    data: Event[] | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
  };
}): ReactElement {
  if (history.isPending) return <p role="status">Carregando acompanhamento…</p>;
  if (history.isError)
    return (
      <Button size="sm" variant="link" onClick={() => void history.refetch()}>
        Tentar carregar acompanhamento
      </Button>
    );
  if (!history.data?.length)
    return <p className={styles.emptyHistory}>Nenhuma intervenção registrada para este vínculo.</p>;
  const recent = history.data.slice(0, RECENT_EVENT_COUNT);
  const earlier = history.data.slice(RECENT_EVENT_COUNT);
  const renderEvent = (item: Event): ReactElement => (
    <TimelineItem key={item.id} id={id} item={item} links={links} />
  );
  return (
    <>
      <ol className={styles.timeline}>{recent.map((item) => renderEvent(item))}</ol>
      {earlier.length > 0 && (
        <details className={styles.earlierEvents}>
          <summary>Histórico anterior ({earlier.length})</summary>
          <ol className={styles.timeline}>{earlier.map((item) => renderEvent(item))}</ol>
        </details>
      )}
    </>
  );
}

function verbalDescription(verbal: boolean | null): string {
  if (verbal === null) return "Manifestação verbal não informada no registro.";
  return verbal
    ? "O aluno ou a família mencionou a possibilidade de saída."
    : "Sem manifestação verbal de saída.";
}

function TimelineItem({ item, id, links }: TimelineProps & { item: Event }): ReactElement {
  return (
    <li>
      <h3>{(item.reassessment && outcomes[item.reassessment]) || titles[item.kind]}</h3>
      <small>
        {item.recordedBy?.name ?? "Autor não informado"} ·{" "}
        <time dateTime={item.createdAt.toISOString()}>{stamp.format(item.createdAt)}</time>
      </small>
      {item.riskReason && <p>Motivo do risco de saída: {exitRiskReasonLabels[item.riskReason]}</p>}
      <p>{item.narrative}</p>
      {item.kind === "RISK" && <p>{verbalDescription(item.verbalReport)}</p>}
      {item.healthScore !== null && (
        <small>Saúde do vínculo ao sinalizar: {item.healthScore}</small>
      )}
      <InterventionOutcome item={item} />
      {(item.renewalId || item.renegotiationId) && (
        <FinancialReference item={item} id={id} links={links} />
      )}
    </li>
  );
}

function InterventionOutcome({ item }: { item: Event }): ReactElement {
  return (
    <>
      {item.nextOwner && (
        <p>
          <strong>Próximo responsável</strong> · {item.nextOwner}
        </p>
      )}
      {item.outcome && (
        <p>
          <strong>
            {item.kind === "CHANGE_REQUEST"
              ? "Motivo da troca"
              : item.kind === "HANDOFF"
                ? "Combinado"
                : "Resultado"}
          </strong>{" "}
          · {item.outcome}
        </p>
      )}
    </>
  );
}

type FinancialProps = TimelineProps & { item: Event };
function FinancialReference({ item, id, links }: FinancialProps): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{item.renewalId ? "Consultar renovação" : "Consultar renegociação"}</summary>
      {open && <FinancialTerms id={id} item={item} />}
      <Button
        size="sm"
        variant="link"
        nativeButton={false}
        render={<Link href={links.profile({ secao: "financeiro" })} />}
      >
        Abrir Financeiro <ArrowUpRight />
      </Button>
    </details>
  );
}

function FinancialTerms({ id, item }: Pick<FinancialProps, "id" | "item">): ReactElement {
  const records = trpc.semesterOrganization.caseFinance.useQuery({ id });
  if (records.isPending) return <p>Carregando negociação…</p>;
  if (records.isError)
    return (
      <Button size="sm" variant="link" onClick={() => void records.refetch()}>
        Tentar novamente
      </Button>
    );
  const agreement = records.data.agreements.find((entry) => entry.id === item.renegotiationId);
  if (agreement)
    return (
      <>
        <p>{agreement.reason}</p>
        <p>
          {agreement.installmentCount} parcela(s) de {formatBRLFromCents(agreement.newAmountCents)}
        </p>
        <small>
          {agreement.actorName} · Vigência em {formatDateOnlyBR(dateOnly(agreement.effectiveDate))}
        </small>
      </>
    );
  const renewal = records.data.renewals.find((entry) => entry.id === item.renewalId);
  if (!renewal) return <p>Registro financeiro indisponível.</p>;
  return (
    <p>
      Contrato renovado
      {renewal.startsOn && ` de ${formatDateOnlyBR(dateOnly(renewal.startsOn))}`}
      {renewal.endsOn && ` até ${formatDateOnlyBR(dateOnly(renewal.endsOn))}`}
      {renewal.monthlyAmountCents !== null &&
        ` · ${formatBRLFromCents(renewal.monthlyAmountCents)} por mês`}
    </p>
  );
}
