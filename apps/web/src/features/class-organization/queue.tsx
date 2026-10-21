"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { Badge, Button, Input } from "@lazuli/ui";
import { dateOnly } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { isPending, isQueueItem, stageLabel, type PendingGroup } from "./model";
import { PendingLead, PendingStudent, type QueueProps } from "./queue-details";
import s from "./organization.module.css";

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
  const match = (name: string) =>
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
    <aside className={s.panel} aria-label="Pendências">
      <header className={s.panelHeader}>
        <div className={s.row}>
          <h2>
            Pendências <span className={s.small}>· {count}</span>
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
        <p className={s.small}>
          Alocações, trocas e continuidade. Expanda para cuidar de cada caso.
        </p>
        {count > 6 && (
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
      <div className={s.scroll}>
        {!count && (
          <div className={s.empty}>
            <h3>Nenhuma pendência</h3>
            <p>Leads aguardando turma e alunos que precisam de atenção aparecem aqui.</p>
          </div>
        )}
        {[...groups.values()]
          .sort((a, b) => {
            const attention = (group: PendingGroup) =>
              group.rows.filter((row) => row.continuity === "LEAVING" || row.declinedAt).length;
            return (
              attention(b) - attention(a) ||
              b.rows.length + b.leads.length - (a.rows.length + a.leads.length) ||
              a.stageCode.localeCompare(b.stageCode)
            );
          })
          .map((group) => {
            const rows = group.rows
              .filter((item) => match(item.studentName))
              .sort(
                (a, b) => Number(b.continuity === "LEAVING") - Number(a.continuity === "LEAVING"),
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
                <div className={s.groupHeader}>
                  <h3>
                    {stageLabel(group.stageCode)}{" "}
                    <span className={s.small}>· {group.rows.length + group.leads.length}</span>
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
                    <details key={item.id} className={s.queueEntry} data-attention={leaving}>
                      <summary className={s.queueItem}>
                        <span className={s.person}>
                          <strong>{item.studentName}</strong>
                          <span className={s.queueMeta}>
                            <Badge variant="neutral">Aluno da escola</Badge>
                            <span className={leaving ? s.attention : s.small}>{status}</span>
                          </span>
                          {reason && <span className={s.queuePreview}>{reason}</span>}
                        </span>
                        <ChevronDown size={14} />
                      </summary>
                      {leaving ? (
                        <div className={s.detail}>
                          {reason && <p className="text-caption">{reason}</p>}
                          {item.sourceClassName && (
                            <p className={s.small}>Turma atual: {item.sourceClassName}</p>
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
                  <details key={item.id} className={s.queueEntry}>
                    <summary className={s.queueItem}>
                      <span className={s.person}>
                        <strong>{item.fullName}</strong>
                        <span className={s.queueMeta}>
                          <Badge variant="info">Lead</Badge>
                          <span className={s.small}>
                            {item.allocationPlan ? "Turma proposta" : "Aguardando turma"}
                          </span>
                        </span>
                        {item.allocationPendingReason && (
                          <span className={s.queuePreview}>{item.allocationPendingReason}</span>
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
              className={s.queueItem}
              disabled={ended}
              onClick={() => onAction({ kind: "placement", studentId: intent.studentId })}
            >
              <span className={s.person}>
                <strong>{intent.studentName}</strong>
                <span className={s.queueMeta}>
                  <Badge variant="neutral">Aluno da escola</Badge>
                  <span className={s.small}>Definir estágio</span>
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
            <div className={s.empty}>
              <p>Nenhuma pessoa encontrada. Tente outro nome.</p>
            </div>
          )}
      </div>
    </aside>
  );
}
