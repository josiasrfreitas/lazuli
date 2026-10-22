import type { ReactElement } from "react";
import { UserRound } from "lucide-react";
import { FormSection, Button, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { LessonProgress } from "./lesson-progress";
import { ContentFields, type ContentDraft } from "./content-fields";
import { PlannedReference } from "./shared";
import type { RecordEditor } from "./editor-model";
type Props = { editor: RecordEditor };
type Row = RecordEditor["rows"][number];
export function RecordRoster({
  editor,
  declarations = editor.opened.declarations,
}: Props & { declarations?: RecordEditor["opened"]["declarations"] | undefined }): ReactElement {
  return (
    <FormSection
      className="min-w-0 lg:col-span-2"
      title="Chamada"
      action={
        <span className="text-caption text-muted-foreground">
          {editor.present} {editor.present === 1 ? "presente" : "presentes"}
        </span>
      }
    >
      {editor.errors["presence-first"] && (
        <p role="alert" className="text-caption text-destructive">
          {editor.errors["presence-first"]}
        </p>
      )}
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {editor.rows.map((row) => (
          <div key={row.enrollmentId} className="grid gap-1.5 p-2">
            <RosterName editor={editor} row={row} />
            <PresenceControl editor={editor} row={row} />
            {!row.reviewed && (
              <p className="text-caption text-warning">Presença pendente de revisão</p>
            )}
            {declarations.some((entry) => entry.enrollmentId === row.enrollmentId) && (
              <p className="text-caption text-muted-foreground">
                Declaração recebida · confira a presença
              </p>
            )}
          </div>
        ))}
      </div>
    </FormSection>
  );
}
function contentLabel(row: Row): string {
  if (row.status === "ABSENT") return "Sem realizado";
  return row.draft.account.trim() ? "Relato preenchido" : "Relato pendente";
}
function RosterName({ editor, row }: Props & { row: Row }): ReactElement {
  if (editor.regular) return <p className="text-sm font-medium">{row.name}</p>;
  return (
    <div>
      <Button
        variant={row.enrollmentId === editor.selected ? "secondary" : "ghost"}
        size="sm"
        type="button"
        className="max-w-full justify-start"
        aria-pressed={row.enrollmentId === editor.selected}
        aria-label={`Realizado por ${row.name}`}
        onClick={() => {
          editor.setSelected(row.enrollmentId);
          editor.focus("performed-content");
        }}
      >
        <UserRound aria-hidden />
        <span className="min-w-0 truncate">{row.name}</span>
      </Button>
      <p className="mt-1 text-caption text-muted-foreground">
        {row.stage} · {contentLabel(row)}
      </p>
    </div>
  );
}
function PresenceControl({ editor, row }: Props & { row: Row }): ReactElement {
  if (editor.opened.attendanceReadOnly)
    return (
      <p className="text-caption text-muted-foreground">
        {row.status === "PRESENT" ? "Presente" : "Falta"} · Chamada confirmada
      </p>
    );
  return (
    <SegmentedControl
      size="sm"
      value={row.reviewed ? row.status : null}
      aria-label={`Presença de ${row.name}`}
      onValueChange={(status) => {
        if (status === "PRESENT" || status === "ABSENT")
          editor.setRows((current) =>
            current.map((item) =>
              item.enrollmentId === row.enrollmentId
                ? { ...item, status, reviewed: true, manuallyReviewed: true }
                : item,
            ),
          );
      }}
    >
      <SegmentedControlItem
        id={row.enrollmentId === editor.rows[0]?.enrollmentId ? "presence-first" : undefined}
        value="PRESENT"
        aria-label={`${row.name}: presente`}
      >
        Presente
      </SegmentedControlItem>
      <SegmentedControlItem value="ABSENT" aria-label={`${row.name}: falta`}>
        Falta
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
export function RecordContent({ editor }: Props): ReactElement {
  const heading = contentHeading(editor);
  return (
    <FormSection
      id="performed-content"
      tabIndex={-1}
      className="min-w-0 lg:sticky lg:top-4 lg:col-span-3"
      title={heading.title}
      description={heading.description}
    >
      {editor.regular ? <SharedContent editor={editor} /> : <IndividualContent editor={editor} />}
      <details className="text-caption">
        <summary className="w-fit cursor-pointer py-1 text-interactive">
          Plano registrado para esta aula
        </summary>
        <PlannedReference
          value={
            editor.regular ? editor.opened.snapshot.sharedPlanned : (editor.active?.planned ?? null)
          }
        />
      </details>
    </FormSection>
  );
}
function SharedContent({ editor }: Props): ReactElement {
  if (editor.present === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Sem presentes nesta aula. Registre abaixo a observação do encontro.
      </p>
    );
  const session = editor.opened.session;
  return (
    <ContentFields
      prefix="shared"
      value={editor.shared}
      change={editor.setShared}
      errors={editor.errors}
      clearError={editor.clearError}
      planning={
        <LessonProgress
          scope={{ classId: session.classId, date: session.date, startTime: session.startTime }}
          prefix="shared"
          value={editor.shared}
          change={editor.setShared}
        />
      }
    />
  );
}
function IndividualContent({ editor }: Props): ReactElement {
  const active = editor.active;
  if (!active)
    return <p className="text-sm text-muted-foreground">Selecione um aluno na chamada.</p>;
  if (active.status === "ABSENT") {
    return (
      <p className="text-sm text-muted-foreground">
        Este aluno está marcado como falta. A baixa não incluirá conteúdo realizado para ele.
      </p>
    );
  }
  const session = editor.opened.session;
  const scope = { classId: session.classId, date: session.date, startTime: session.startTime };
  const change = (draft: ContentDraft): void =>
    editor.setRows((current) =>
      current.map((row) => (row.enrollmentId === active.enrollmentId ? { ...row, draft } : row)),
    );
  return (
    <ContentFields
      prefix={active.enrollmentId}
      value={active.draft}
      errors={editor.errors}
      clearError={editor.clearError}
      change={change}
      planning={
        active.progressId ? (
          <LessonProgress
            scope={{ ...scope, progressId: active.progressId }}
            prefix={active.enrollmentId}
            value={active.draft}
            change={change}
          />
        ) : undefined
      }
    />
  );
}

function contentHeading(editor: RecordEditor): { title: string; description: string } {
  if (editor.regular)
    return {
      title: "Realizado pela turma",
      description: "Um registro compartilhado por este encontro.",
    };
  return {
    title: editor.active?.name ?? "Conteúdo individual",
    description: editor.active?.stage ?? "Selecione um aluno na chamada.",
  };
}
