"use client";
import { useState, type JSX as ReactJSX } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Badge, Button, Input } from "@lazuli/ui";
import { dateOnly } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import type { QueueProps } from "./queue-details";
import { QueueGroup } from "./queue-groups";
import { queueData, matchesSearch, type QueueData } from "./queue-model";
import styles from "./organization.module.css";

const QUEUE_SEARCH_THRESHOLD = 6;

export function AccommodationQueue(props: QueueProps): ReactJSX.Element {
  const [search, setSearch] = useState("");
  const { board, onAction, onSelect } = props;
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const data = queueData(board);
  return (
    <aside className={styles.panel} aria-label="Pendências">
      <QueueHeader
        count={data.count}
        ended={ended}
        search={search}
        onSearch={setSearch}
        onAction={onAction}
      />
      <QueueContents
        data={data}
        board={board}
        ended={ended}
        search={search}
        onAction={onAction}
        onSelect={onSelect}
      />
    </aside>
  );
}

function QueueHeader({
  count,
  ended,
  search,
  onSearch,
  onAction,
}: {
  count: number;
  ended: boolean;
  search: string;
  onSearch: (value: string) => void;
  onAction: QueueProps["onAction"];
}): ReactJSX.Element {
  return (
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
          onChange={(event) => onSearch(event.target.value)}
        />
      )}
    </header>
  );
}

function QueueContents({
  data,
  board,
  ended,
  search,
  onAction,
  onSelect,
}: QueueProps & { data: QueueData; ended: boolean; search: string }): ReactJSX.Element {
  return (
    <div className={styles.scroll}>
      {!data.count && (
        <div className={styles.empty}>
          <h3>Nenhuma pendência</h3>
          <p>Leads aguardando turma e alunos que precisam de atenção aparecem aqui.</p>
        </div>
      )}
      {data.groups.map((group) => (
        <QueueGroup
          key={group.stageId}
          group={group}
          board={board}
          search={search}
          ended={ended}
          onAction={onAction}
          onSelect={onSelect}
        />
      ))}
      {data.intents
        .filter((intent) => matchesSearch(intent.studentName, search))
        .map((intent) => (
          <QueueIntent key={intent.id} intent={intent} ended={ended} onAction={onAction} />
        ))}
      {search &&
        ![
          ...data.pending.map((item) => item.studentName),
          ...data.leads.map((item) => item.fullName),
          ...data.intents.map((item) => item.studentName),
        ].some((name) => matchesSearch(name, search)) && (
          <div className={styles.empty}>
            <p>Nenhuma pessoa encontrada. Tente outro nome.</p>
          </div>
        )}
    </div>
  );
}

function QueueIntent({
  intent,
  ended,
  onAction,
}: {
  intent: QueueData["intents"][number];
  ended: boolean;
  onAction: QueueProps["onAction"];
}): ReactJSX.Element {
  return (
    <button
      type="button"
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
  );
}
