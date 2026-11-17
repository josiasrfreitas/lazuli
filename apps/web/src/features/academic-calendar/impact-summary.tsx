"use client";
import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, CalendarX2, ChevronDown, TriangleAlert, UserRound } from "lucide-react";
import { Alert } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
import styles from "./impact.module.css";

export type ImpactPreview = RouterOutputs["calendar"]["academic"]["changes"]["preview"];
type ClassImpact = ImpactPreview["teachers"][number]["classes"][number];
const hours = (minutes: number): string => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
const range = (from: string, through: string): string => from === through
  ? formatDateOnlyBR(from)
  : `${formatDateOnlyBR(from)} a ${formatDateOnlyBR(through)}`;

export function ImpactOverview({ preview }: { preview: ImpactPreview }): ReactElement {
  const total = preview.sessions.length + preview.appointments.length + preview.visits.length;
  return (
    <section className={styles.overview}>
      <h3 id="calendar-review-start" tabIndex={-1}>O que muda</h3>
      {preview.periodChange ? (
        <div className={styles.dateChange}>
          <div><span>Período atual</span><strong>{range(preview.periodChange.before.from, preview.periodChange.before.through)}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div><span>Novo período</span><strong>{range(preview.periodChange.after.from, preview.periodChange.after.through)}</strong></div>
        </div>
      ) : <p>{range(preview.from, preview.through)}</p>}
      <p className={styles.consequence} data-destructive={total > 0}>
        <CalendarX2 aria-hidden="true" />
        <span>{total > 0 ? <><strong>{total} {total === 1 ? "atividade futura será cancelada" : "atividades futuras serão canceladas"}.</strong> Confira as turmas abaixo.</> : "Nenhuma atividade futura será cancelada."}</span>
      </p>
    </section>
  );
}

export function TeacherImpacts({ preview }: { preview: ImpactPreview }): ReactElement | null {
  if (!preview.teachers.length) return null;
  const classes = new Map(preview.teachers.flatMap((teacher) => teacher.classes.map((row) => [row.classId, row] as const)));
  const risks = [...classes.values()].filter((row) => (row.deficitMinutes ?? 0) > 0);
  return (
    <section className={styles.teachers} aria-label="Turmas afetadas por professor">
      <div className={styles.sectionHeading}>
        <h3>Turmas afetadas</h3>
        <span>{classes.size} {classes.size === 1 ? "turma" : "turmas"} · {preview.teachers.length} {preview.teachers.length === 1 ? "professor" : "professores"}</span>
      </div>
      {risks.length > 0 && (
        <div className={styles.gradeRisk}>
          <TriangleAlert aria-hidden="true" />
          <div><h4>Turmas que podem não concluir a grade · {risks.length}</h4><p>Com o novo calendário, a carga disponível fica abaixo da prevista no plano. Veja a diferença nas turmas sinalizadas.</p></div>
        </div>
      )}
      {preview.teachers.map((teacher, index) => (
        <details key={teacher.teacherId ?? "unassigned"} className={styles.teacherGroup} open={index === 0}>
          <summary className={styles.teacherHeading}>
            <UserRound aria-hidden="true" />
            <span className={styles.teacherName}>{teacher.name}</span>
            <span>{teacher.classes.length} {teacher.classes.length === 1 ? "turma" : "turmas"} · {teacher.classes.reduce((total, row) => total + row.lessons, 0)} aulas a cancelar</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <ul className={styles.classList}>
            {teacher.classes.map((row) => <AffectedClass key={row.classId} row={row} />)}
          </ul>
        </details>
      ))}
    </section>
  );
}

function AffectedClass({ row }: { row: ClassImpact }): ReactElement {
  const risk = (row.deficitMinutes ?? 0) > 0;
  return (
    <li className={styles.classItem}>
      <div className={styles.classHeading}>
        <div>
          <Link href={`/turmas/${row.classId}?secao=planejamento`} className={styles.className}>
            {row.stageName ?? (row.scheduleType === "REGULAR" ? "Turma regular" : "Turma personalizada")}
          </Link>
          <p>{row.name} · {row.periodName}</p>
        </div>
        <span className={styles.lessonCount} data-cancelled={row.lessons > 0}>
          {row.lessons > 0 ? `${row.lessons} ${row.lessons === 1 ? "aula a cancelar" : "aulas a cancelar"}` : "Sem aulas a cancelar"}
        </span>
      </div>
      <p className={styles.affectedRange}>Datas afetadas · {range(row.from, row.through)}</p>
      {risk && <p className={styles.deficit}><TriangleAlert aria-hidden="true" /><span>Faltam {hours(row.deficitMinutes!)} para concluir a grade · {hours(row.availableMinutes)} disponíveis de {hours(row.requiredMinutes!)} previstas.</span></p>}
      {row.planItems > 0 && <p className={styles.planNote}>{row.planItems} {row.planItems === 1 ? "item do planejamento precisa" : "itens do planejamento precisam"} de nova data.</p>}
      {row.requiredMinutes === null && <p className={styles.planNote}>A carga horária do plano não está definida; a conclusão da grade não pôde ser avaliada.</p>}
    </li>
  );
}

export function OtherImpacts({ preview }: { preview: ImpactPreview }): ReactElement {
  const individualPlans = preview.plans.filter((row) => !row.classId);
  return (
    <>
      {([ ["Atendimentos", preview.appointments], ["Aulas experimentais e visitas", preview.visits] ] as const).filter(([, rows]) => rows.length > 0).map(([label, rows]) => (
        <details key={label} className={styles.otherImpact}>
          <summary>{label} a cancelar · {rows.length}</summary>
          <ul>{rows.map((row) => <li key={row.id}>{row.name} · {formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}</li>)}</ul>
        </details>
      ))}
      {individualPlans.length > 0 && <p className={styles.planNote}>{individualPlans.length} itens de planos individuais também precisam de nova data.</p>}
      {preview.releasedDates.length > 0 && <Alert>{preview.releasedDates.length} dias serão liberados. Aulas já canceladas não serão reativadas automaticamente.</Alert>}
    </>
  );
}
