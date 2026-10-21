import type { ReactElement } from "react";
import { TaskDialog } from "~/features/shared/task-form";
import { attendanceLabel } from "./shared";
import type { RecordEditor } from "./editor-model";
function reviewSummary(editor: RecordEditor): string {
  if (editor.present === 0)
    return "A aula será registrada sem presentes, com a observação informada.";
  if (editor.regular) return "O relato compartilhado será salvo junto da chamada.";
  return editor.present === 1
    ? "1 relato individual será salvo junto da chamada."
    : `${editor.present} relatos individuais serão salvos junto da chamada.`;
}
export function RecordReview({ editor }: { editor: RecordEditor }): ReactElement | null {
  const { review, opened, save } = editor;
  if (!review) return null;
  const absent = editor.rows.filter((row) => row.status === "ABSENT").map((row) => row.name);
  return (
    <TaskDialog
      title={opened.version ? "Confirmar correção" : "Confirmar baixa da aula"}
      description={`${opened.session.className} · ${attendanceLabel(editor.present, editor.rows.length)}.`}
      formId="confirm-class-record"
      firstField="record-review-summary"
      pending={save.isPending}
      submitLabel={opened.version ? "Salvar correção" : "Confirmar baixa"}
      onClose={() => editor.setReview(null)}
      error={save.error?.message}
    >
      <form
        id="confirm-class-record"
        noValidate
        className="grid gap-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!save.isPending) save.mutate(review);
        }}
      >
        <div id="record-review-summary" tabIndex={-1} className="grid gap-2">
          <p className="text-sm">{reviewSummary(editor)}</p>
          {absent.length > 0 && (
            <p className="text-caption text-muted-foreground">Faltas: {absent.join(", ")}.</p>
          )}
          {editor.needsReason && (
            <p className="whitespace-pre-wrap text-sm">Motivo: {editor.reason}</p>
          )}
        </div>
      </form>
    </TaskDialog>
  );
}
