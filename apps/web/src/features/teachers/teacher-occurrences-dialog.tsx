"use client";
import { useState, type ReactElement, type RefObject } from "react";
import Link from "next/link";
import { ArrowUpRight, MessageSquareText, Zap } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Avatar,
  Badge,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  EmptyState,
  Input,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { CATEGORY, OCCURRENCE_STATUS, dateLabel } from "~/features/pedagogical-follow-up/shared";
import { studentFollowUpHref } from "~/features/pedagogical-follow-up/student-navigation";
import styles from "./teacher-occurrences-dialog.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];
type Occurrence = Metrics["occurrences"][number];

export function TeacherOccurrencesDialog({
  data,
  onClose,
  returnFocus,
}: {
  data: Metrics;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}): ReactElement {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const normalize = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  const open = data.occurrences.filter((row) => row.status !== "CLOSED").length;
  const rows = data.occurrences.filter(
    (row) =>
      (filter === "all" ||
        (filter === "open" ? row.status !== "CLOSED" : row.status === "CLOSED")) &&
      normalize(`${row.name} ${row.title} ${CATEGORY[row.category]}`).includes(normalize(search)),
  );
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-3xl" finalFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>
              <span className={styles.title}>
                <MessageSquareText aria-hidden="true" />
                Acompanhamento dos alunos
              </span>
            </DialogTitle>
            <DialogDescription>
              Ocorrências dos alunos atuais neste semestre, em aula e fora dela.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.toolbar}>
            <SegmentedControl
              size="sm"
              value={filter}
              aria-label="Filtrar ocorrências"
              onValueChange={(value) => {
                if (value) setFilter(value);
              }}
            >
              <SegmentedControlItem value="all">
                Todas · {data.occurrences.length}
              </SegmentedControlItem>
              <SegmentedControlItem value="open">Em aberto · {open}</SegmentedControlItem>
              <SegmentedControlItem value="closed">
                Encerradas · {data.occurrences.length - open}
              </SegmentedControlItem>
            </SegmentedControl>
            <Input
              size="sm"
              type="search"
              aria-label="Buscar ocorrência por aluno, título ou contexto"
              placeholder="Buscar aluno ou ocorrência"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <DialogBody>
            {rows.length ? (
              <ul className={styles.list}>
                {rows.map((row) => (
                  <OccurrenceItem key={row.id} row={row} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Tudo tranquilo neste recorte"
                description="Nenhuma ocorrência encontrada. Experimente outro filtro ou nome."
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function OccurrenceItem({ row }: { row: Occurrence }): ReactElement {
  return (
    <li className={styles.item}>
      <header className={styles.identity}>
        <Avatar name={row.name} colorKey={row.studentId} size="md" />
        <div>
          <Link href={`/alunos/${row.studentId}?secao=pedagogico`}>{row.name}</Link>
          <p>
            {row.outsideClass ? "Fora de aula" : "Em aula"}
            {row.date ? ` · ${dateLabel(row.date)}` : ""} · {CATEGORY[row.category]}
          </p>
        </div>
        <Badge
          variant={
            row.status === "CLOSED" ? "success" : row.status === "FOLLOWING_UP" ? "info" : "warning"
          }
        >
          {OCCURRENCE_STATUS[row.status]}
        </Badge>
      </header>
      <h3>{row.title}</h3>
      <p className={styles.report}>{row.summary}</p>
      {row.initialResponse && (
        <div className={styles.response}>
          <span>
            <Zap aria-hidden="true" />
            Ação imediata
          </span>
          <p>{row.initialResponse}</p>
        </div>
      )}
      <footer className={styles.footer}>
        <div>
          <span>{row.accompanied ? "Com intervenção vinculada" : "Sem intervenção vinculada"}</span>
          <small>Registrado por {row.recordedBy}</small>
        </div>
        <Link href={studentFollowUpHref(row.studentId, { kind: "occurrence", id: row.id })}>
          Ver relato completo <ArrowUpRight aria-hidden="true" />
        </Link>
      </footer>
    </li>
  );
}
