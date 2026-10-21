"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { Badge, Button, Input } from "@lazuli/ui";
import { dateOnly } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { isPending, isQueueItem, stageLabel, type PendingGroup } from "./model";
import { PendingLead, PendingStudent, type QueueProps } from "./queue-details";
import styles from "./organization.module.css";

const QUEUE_SEARCH_THRESHOLD = 6;

export function AccommodationQueue({ board, onAction, onSelect }: QueueProps): ReactJSX.Element {
  const [search, setSearch] = useState("");
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const pending = board.placements.filter(isQueueItem);
  const leads = board.waitingLeads.filter(
    (lead) => !pending.some((row) => row.studentId === lead.studentId),
  );
  const intents = board.intents.filter(
    (intent) => !leads.some((lead) => lead.studentId === intent.studentId),
  );
  const match = (name: string): boolean =>
    name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  const groups = new Map<string, PendingGroup>();
  for (const item of pending) {
    const key = item.stageId ?? "";
    const group = groups.get(key) ?? {
      stageId: key,
      stageCode: item.stageCode ?? "",
      rows: [],
      leads: [],
    };
    group.rows.push(item);
    groups.set(key, group);
  }
  for (const item of leads) {
    const key = item.stageId ?? "";
    const group = groups.get(key) ?? {
      stageId: key,
      stageCode: item.stage?.internalCode ?? "",
      rows: [],
      leads: [],
    };
    group.leads.push(item);
    groups.set(key, group);
  }
  const count = pending.length + leads.length + intents.length;
  return (
    <aside className={styles.panel} aria-label="Pendências">
      <header className={styles.panelHeader}>
        <div className={styles.row}>
          <h2>
            Pendências <span className={styles.small}>· {count}</span>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            disabled={ended}
            aria-label="Adicionar aluno à organização"
            onClick={() => onAction({ kind: "findStudent" })}
          >
            <Plus size={16} />
          </Button>
        </div>
        <p className={styles.small}>
          Alocações, trocas e continuidade. Expanda para cuidar de cada caso.
        </p>
        {count > QUEUE_SEARCH_THRESHOLD && (
          <Input
            size="sm"
            leadingIcon={<Search size={14} />}
            aria-label="Buscar pessoa nas pendências"
            placeholder="Buscar pessoa…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
      </header>
      <div className={styles.scroll}>
        {!count && (
          <div className={styles.empty}>
            <h3>Nenhuma pendência</h3>
            <p>Leads aguardando turma e alunos que precisam de atenção aparecem aqui.</p>
          </div>
        )}
        {[...groups.values()]
          .toSorted((left, right) => {
            const attention = (group: PendingGroup): number =>
              group.rows.filter((row) => row.continuity === "LEAVING" || row.declinedAt).length;
            return (
              attention(right) - attention(left) ||
              right.rows.length + right.leads.length - (left.rows.length + left.leads.length) ||
              left.stageCode.localeCompare(right.stageCode)
            );
          })
          .map((group) => {
            const rows = group.rows
              .filter((item) => match(item.studentName))
              .toSorted(
                (left, right) =>
                  Number(right.continuity === "LEAVING") - Number(left.continuity === "LEAVING"),
              );
            const items = group.leads.filter((item) => match(item.fullName));
            if (rows.length === 0 && items.length === 0) return null;
            const allocationGroup = { ...group, rows: group.rows.filter(isPending) };
            const available = allocationGroup.rows.length + group.leads.length;
            return (
              <section
                key={group.stageId}
                aria-label={`Pendências · ${stageLabel(group.stageCode)}`}
              >
                <div className={styles.groupHeader}>
                  <h3>
                    {stageLabel(group.stageCode)}{" "}
                    <span className={styles.small}>· {group.rows.length + group.leads.length}</span>
                  </h3>
                  {group.stageId && available >= 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={ended}
                      onClick={() => onAction({ kind: "plan", group: allocationGroup })}
                    >
                      Formar turma
                    </Button>
                  )}
                </div>
                {rows.map((item) => {
                  const leaving = item.continuity === "LEAVING" || Boolean(item.declinedAt);
                  const status = leaving
                    ? "Possível saída"
                    : item.continuity === "CHANGE"
                      ? "Troca de turma"
                      : item.planId
                        ? "Alocação a confirmar"
                        : "Aguardando turma";
                  const reason = item.continuityReason || item.declinedReason || item.notes;
                  return (
                    <details key={item.id} className={styles.queueEntry} data-attention={leaving}>
                      <summary className={styles.queueItem}>
                        <span className={styles.person}>
                          <strong>{item.studentName}</strong>
                          <span className={styles.queueMeta}>
                            <Badge variant="neutral">Aluno da escola</Badge>
                            <span className={leaving ? styles.attention : styles.small}>
                              {status}
                            </span>
                          </span>
                          {reason && <span className={styles.queuePreview}>{reason}</span>}
                        </span>
                        <ChevronDown size={14} />
                      </summary>
                      {leaving ? (
                        <div className={styles.detail}>
                          {reason && <p className="text-caption">{reason}</p>}
                          {item.sourceClassName && (
                            <p className={styles.small}>Turma atual: {item.sourceClassName}</p>
                          )}
                          <Button
                            size="sm"
                            disabled={ended}
                            onClick={() => onAction({ kind: "continuity", row: item })}
                          >
                            Revisar continuidade
                          </Button>
                          {item.planId && (
                            <Button size="sm" variant="ghost" onClick={() => onSelect(item.planId)}>
                              Ver turma
                            </Button>
                          )}
                        </div>
                      ) : (
                        <PendingStudent
                          row={item}
                          board={board}
                          onAction={onAction}
                          onSelect={onSelect}
                        />
                      )}
                    </details>
                  );
                })}
                {items.map((item) => (
                  <details key={item.id} className={styles.queueEntry}>
                    <summary className={styles.queueItem}>
                      <span className={styles.person}>
                        <strong>{item.fullName}</strong>
                        <span className={styles.queueMeta}>
                          <Badge variant="info">Lead</Badge>
                          <span className={styles.small}>
                            {item.allocationPlan ? "Turma proposta" : "Aguardando turma"}
                          </span>
                        </span>
                        {item.allocationPendingReason && (
                          <span className={styles.queuePreview}>
                            {item.allocationPendingReason}
                          </span>
                        )}
                      </span>
                      <ChevronDown size={14} />
                    </summary>
                    <PendingLead lead={item} board={board} onSelect={onSelect} />
                  </details>
                ))}
              </section>
            );
          })}
        {intents
          .filter((intent) => match(intent.studentName))
          .map((intent) => (
            <button
              type="button"
              key={intent.id}
              className={styles.queueItem}
              disabled={ended}
              onClick={() => onAction({ kind: "placement", studentId: intent.studentId })}
            >
              <span className={styles.person}>
                <strong>{intent.studentName}</strong>
                <span className={styles.queueMeta}>
                  <Badge variant="neutral">Aluno da escola</Badge>
                  <span className={styles.small}>Definir estágio</span>
                </span>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        {search &&
          ![
            ...pending.map((item) => item.studentName),
            ...leads.map((item) => item.fullName),
            ...intents.map((item) => item.studentName),
          ].some(match) && (
            <div className={styles.empty}>
              <p>Nenhuma pessoa encontrada. Tente outro nome.</p>
            </div>
          )}
      </div>
    </aside>
  );
}
