"use client";
import type { ReactElement } from "react";
import { ClipboardCheck, X } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { NarrativeField } from "~/features/shared/task-form";
import type { ClassRecord } from "./shared";
import { useRecordEditor, type RecordEditor } from "./editor-model";
import { RecordRoster, RecordContent } from "./editor-fields";
import { RecordReview } from "./editor-review";
export function ClassRecordEditor({
  data,
  onClose,
}: {
  data: ClassRecord;
  onClose: () => void;
}): ReactElement {
  const editor = useRecordEditor(data, onClose);
  return (
    <>
      <form
        id="class-record-editor"
        className="grid min-w-0 gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          editor.prepare();
        }}
      >
        <EditorNotice editor={editor} />
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-5">
          <RecordRoster editor={editor} />
          <RecordContent editor={editor} />
        </div>
        <EditorNotes editor={editor} />
        <EditorActions editor={editor} onClose={onClose} />
      </form>
      <RecordReview editor={editor} />
    </>
  );
}
function EditorNotice({ editor: { opened } }: { editor: RecordEditor }): ReactElement | null {
  if (opened.attendanceReadOnly)
    return (
      <Alert>
        Complete o relato mantendo a chamada confirmada. Alterações de presença em dias anteriores
        cabem à administração.
      </Alert>
    );
  if (opened.attendanceOnly)
    return (
      <Alert>
        Esta chamada já foi confirmada. Confira a presença e complete o registro do que foi
        realizado.
      </Alert>
    );
  if (opened.version) return null;
  return (
    <Alert>
      A chamada manual começa com os alunos presentes. Revise a lista antes de conferir e dar baixa;
      nada está salvo ainda.
    </Alert>
  );
}
function EditorNotes({ editor }: { editor: RecordEditor }): ReactElement {
  return (
    <div className="grid max-w-3xl gap-4">
      <NarrativeField
        name="note"
        label={
          editor.present === 0
            ? "Observação da aula · obrigatória"
            : "Observação da aula · opcional"
        }
        placeholder="Ex.: combinamos uma retomada oral no próximo encontro"
        value={editor.note}
        onChange={(value) => {
          editor.setNote(value);
          editor.clearError("note");
        }}
        error={editor.errors.note}
        rows={2}
      />
      {editor.needsReason && (
        <NarrativeField
          name="reason"
          label="Motivo da correção"
          placeholder="Ex.: corrigir a presença após conferência com o professor"
          value={editor.reason}
          onChange={(value) => {
            editor.setReason(value);
            editor.clearError("reason");
          }}
          error={editor.errors.reason}
        />
      )}
    </div>
  );
}
function EditorActions({
  editor: { opened },
  onClose,
}: {
  editor: RecordEditor;
  onClose: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
      <p className="text-caption text-muted-foreground">
        {opened.version
          ? "A versão anterior ficará preservada no histórico."
          : "Confira a chamada e o conteúdo antes de confirmar a baixa."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {opened.version > 0 && (
          <Button variant="secondary" type="button" onClick={onClose}>
            <X aria-hidden />
            Cancelar correção
          </Button>
        )}
        <Button type="submit">
          <ClipboardCheck aria-hidden />
          {opened.version ? "Conferir correção" : "Conferir e dar baixa"}
        </Button>
      </div>
    </div>
  );
}
