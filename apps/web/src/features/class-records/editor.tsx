"use client";
import { ClipboardCheck, UserRound, X } from "lucide-react";
import { useState, useEffect, type ReactElement } from "react";
import { classRecordSaveSchema, type ClassRecordSave } from "@lazuli/validators";
import { Alert, Button, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { ContentFields, contentInput, draftContent } from "./content-fields";
import { attendanceLabel, PlannedReference, type ClassRecord } from "./shared";
import {
  DeclarationEvidence,
  type AttendanceStatus,
} from "~/features/student-attendance/staff-section";
export function ClassRecordEditor({
  data,
  onClose,
  declarations,
  externalSubmit = false,
  onStateChange,
}: {
  data: ClassRecord;
  onClose: () => void;
  declarations: AttendanceStatus["declarations"];
  externalSubmit?: boolean;
  onStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
}): ReactElement {
  const [opened] = useState(data);
  const regular = opened.session.scheduleType === "REGULAR";
  const [rows, setRows] = useState(
    opened.snapshot.entries.map((row) => ({
      ...row,
      status:
        opened.version || opened.attendanceOnly
          ? row.status
          : declarations.some((item) => item.enrollmentId === row.enrollmentId)
            ? ("PRESENT" as const)
            : ("PENDING" as const),
      draft: draftContent(row.content),
    })),
  );
  const [selected, setSelected] = useState(
    rows.find((row) => row.status === "PRESENT")?.enrollmentId ?? rows[0]?.enrollmentId,
  );
  const [shared, setShared] = useState(draftContent(opened.snapshot.sharedContent));
  const [note, setNote] = useState(opened.snapshot.note ?? "");
  const [reason, setReason] = useState("");
  const [initialDraft] = useState(() => JSON.stringify({ rows, shared, note, reason }));
  const dirty = JSON.stringify({ rows, shared, note, reason }) !== initialDraft;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusField, setFocusField] = useState<{ id: string } | null>(null);
  const [review, setReview] = useState<ClassRecordSave | null>(null);
  const utils = trpc.useUtils();
  const save = trpc.classRecords.save.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classRecords.invalidate(),
        utils.students.invalidate(),
        utils.classes.invalidate(),
        utils.activity.invalidate(),
        utils.studentAttendance.invalidate(),
        utils.teacherWorkspace.invalidate(),
        utils.planning.invalidate(),
      ]);
      setReview(null);
      onClose();
    },
  });
  useEffect(() => {
    onStateChange?.({ dirty, pending: save.isPending });
  }, [dirty, save.isPending, onStateChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    document.getElementById("presence-first")?.focus();
  }, []);
  useEffect(() => {
    if (focusField) document.getElementById(focusField.id)?.focus();
  }, [focusField]);
  const active = rows.find((row) => row.enrollmentId === selected);
  const attendanceChanged =
    opened.attendanceOnly &&
    rows.some(
      (row) =>
        opened.snapshot.entries.find((original) => original.enrollmentId === row.enrollmentId)
          ?.status !== row.status,
    );
  const needsReason = opened.version > 0 || attendanceChanged;
  const present = rows.filter((row) => row.status === "PRESENT").length;
  function prepare(): void {
    const value = {
      sessionId: opened.session.id,
      version: opened.version,
      attendanceStamp: opened.attendanceStamp,
      sharedContent: regular && present > 0 ? contentInput(shared) : null,
      rows: rows.map((row) => ({
        enrollmentId: row.enrollmentId,
        status: row.status,
        content: !regular && row.status === "PRESENT" ? contentInput(row.draft) : null,
      })),
      note: note.trim() || null,
      ...(needsReason ? { reason } : {}),
    };
    const parsed = classRecordSaveSchema.safeParse(value);
    const nextErrors: Record<string, string> = {};
    if (rows.some((row) => row.status === "PENDING"))
      nextErrors.presence = "Revise cada aluno: marque presente ou falta antes de confirmar.";
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key =
          issue.path[0] === "rows"
            ? `${rows[Number(issue.path[1])]?.enrollmentId}-${issue.path.at(-1)}`
            : issue.path[0] === "sharedContent"
              ? `shared-${issue.path.at(-1)}`
              : String(issue.path[0]);
        nextErrors[key] = issue.message;
      }
    if (needsReason && reason.trim().length < 3)
      nextErrors.reason = "Explique o motivo da correção.";
    if (present === 0 && !note.trim()) nextErrors.note = "Explique a aula sem alunos presentes.";
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      const student = rows.find((row) => first.startsWith(row.enrollmentId));
      if (student) setSelected(student.enrollmentId);
      setFocusField({ id: first });
      return;
    }
    if (parsed.success) {
      save.reset();
      setReview(parsed.data);
    }
  }
  return (
    <>
      <form
        id="class-record-editor"
        className="grid min-w-0 gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          prepare();
        }}
      >
        {opened.attendanceOnly && (
          <Alert>
            Esta chamada já foi confirmada. Confira a presença e complete o registro do que foi
            realizado.
          </Alert>
        )}
        {!opened.version && !opened.attendanceOnly && (
          <Alert>
            Confira as declarações e marque a presença de cada aluno. Alunos sem resposta não serão
            considerados presentes automaticamente.
          </Alert>
        )}
        {errors.presence && <Alert variant="destructive">{errors.presence}</Alert>}
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-5">
          <section className="grid min-w-0 gap-3 lg:col-span-2" aria-label="Chamada da aula">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Chamada</h2>
              <span className="text-caption text-muted-foreground">
                {present} {present === 1 ? "presente" : "presentes"} ·{" "}
                {rows.filter((row) => row.status === "PENDING").length} por revisar
              </span>
            </div>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {rows.map((row) => (
                <div key={row.enrollmentId} className="grid gap-1.5 p-2">
                  <div>
                    {regular ? (
                      <p className="text-sm font-medium">{row.name}</p>
                    ) : (
                      <Button
                        variant={row.enrollmentId === selected ? "secondary" : "ghost"}
                        size="sm"
                        type="button"
                        className="max-w-full justify-start"
                        aria-pressed={row.enrollmentId === selected}
                        aria-label={`Realizado por ${row.name}`}
                        onClick={() => {
                          setSelected(row.enrollmentId);
                          setFocusField({ id: "performed-content" });
                        }}
                      >
                        <UserRound aria-hidden="true" />
                        <span className="min-w-0 truncate">{row.name}</span>
                      </Button>
                    )}
                    {!regular && (
                      <p className="mt-1 text-caption text-muted-foreground">
                        {row.stage} ·{" "}
                        {row.status === "ABSENT"
                          ? "Sem realizado"
                          : row.draft.account.trim()
                            ? "Relato preenchido"
                            : "Relato pendente"}
                      </p>
                    )}
                  </div>
                  {declarations
                    .filter((declaration) => declaration.enrollmentId === row.enrollmentId)
                    .map((declaration) => (
                      <DeclarationEvidence key={declaration.id} value={declaration} />
                    ))}
                  <SegmentedControl
                    size="sm"
                    value={row.status}
                    aria-label={`Presença de ${row.name}`}
                    onValueChange={(status) => {
                      if (status === "PRESENT" || status === "ABSENT")
                        setRows((current) =>
                          current.map((item) =>
                            item.enrollmentId === row.enrollmentId ? { ...item, status } : item,
                          ),
                        );
                    }}
                  >
                    <SegmentedControlItem
                      id={row.enrollmentId === rows[0]?.enrollmentId ? "presence-first" : undefined}
                      value="PRESENT"
                      aria-label={`${row.name}: presente`}
                    >
                      Presente
                    </SegmentedControlItem>
                    <SegmentedControlItem value="ABSENT" aria-label={`${row.name}: falta`}>
                      Falta
                    </SegmentedControlItem>
                  </SegmentedControl>
                  {row.status === "PENDING" && (
                    <p className="text-caption text-warning">Presença por revisar</p>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section
            id="performed-content"
            tabIndex={-1}
            className="grid min-w-0 gap-3 lg:sticky lg:top-4 lg:col-span-3"
            aria-label="Conteúdo realizado"
          >
            <div>
              <h2 className="text-sm font-semibold">
                {regular ? "Realizado pela turma" : (active?.name ?? "Conteúdo individual")}
              </h2>
              <p className="mt-1 text-caption text-muted-foreground">
                {regular
                  ? "Um registro compartilhado por este encontro."
                  : (active?.stage ?? "Selecione um aluno na chamada.")}
              </p>
            </div>
            {regular ? (
              present > 0 ? (
                <ContentFields
                  prefix="shared"
                  value={shared}
                  change={setShared}
                  errors={errors}
                  planning={{
                    classId: opened.session.classId,
                    date: opened.session.date,
                    startTime: opened.session.startTime,
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {rows.some((row) => row.status === "PENDING")
                    ? "Revise a chamada para registrar o conteúdo dos alunos presentes."
                    : "Sem presentes nesta aula. Registre abaixo a observação do encontro."}
                </p>
              )
            ) : active?.status === "PRESENT" ? (
              <ContentFields
                prefix={active.enrollmentId}
                value={active.draft}
                change={(draft) =>
                  setRows((current) =>
                    current.map((row) =>
                      row.enrollmentId === active.enrollmentId ? { ...row, draft } : row,
                    ),
                  )
                }
                errors={errors}
                planning={
                  active.progressId
                    ? {
                        classId: opened.session.classId,
                        progressId: active.progressId,
                        date: opened.session.date,
                        startTime: opened.session.startTime,
                      }
                    : undefined
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {active?.status === "PENDING"
                  ? "Marque a presença deste aluno antes de preencher seu conteúdo."
                  : "Este aluno está marcado como falta. A baixa não incluirá conteúdo realizado para ele."}
              </p>
            )}
            <details className="text-caption">
              <summary className="w-fit cursor-pointer py-1 text-interactive">
                Plano registrado para esta aula
              </summary>
              <PlannedReference
                value={regular ? opened.snapshot.sharedPlanned : (active?.planned ?? null)}
              />
            </details>
          </section>
        </div>
        <div className="grid max-w-3xl gap-4">
          <NarrativeField
            name="note"
            label={
              present === 0 ? "Observação da aula · obrigatória" : "Observação da aula · opcional"
            }
            placeholder="Ex.: combinamos uma retomada oral no próximo encontro"
            value={note}
            onChange={setNote}
            error={errors.note}
            rows={2}
          />
          {needsReason && (
            <NarrativeField
              name="reason"
              label="Motivo da correção"
              placeholder="Ex.: corrigir a presença após conferência com o professor"
              value={reason}
              onChange={setReason}
              error={errors.reason}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-caption text-muted-foreground">
            {opened.version
              ? "A versão anterior ficará preservada no histórico."
              : "Confira a chamada e o conteúdo antes de confirmar a baixa."}
          </p>
          {!externalSubmit && (
            <div className="flex flex-wrap items-center gap-2">
              {opened.version > 0 && (
                <Button variant="secondary" type="button" onClick={onClose}>
                  <X aria-hidden="true" />
                  Cancelar correção
                </Button>
              )}
              <Button type="submit">
                <ClipboardCheck aria-hidden="true" />
                {opened.version ? "Conferir correção" : "Conferir e dar baixa"}
              </Button>
            </div>
          )}
        </div>
      </form>
      {review && (
        <TaskDialog
          title={opened.version ? "Confirmar correção" : "Confirmar baixa da aula"}
          description={`${opened.session.className} · ${attendanceLabel(present, rows.length)}.`}
          formId="confirm-class-record"
          firstField="record-review-summary"
          pending={save.isPending}
          submitLabel={opened.version ? "Salvar correção" : "Confirmar baixa"}
          onClose={() => setReview(null)}
          error={save.error?.message}
        >
          <form
            id="confirm-class-record"
            className="grid gap-4 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!save.isPending) save.mutate(review);
            }}
          >
            <div id="record-review-summary" tabIndex={-1} className="grid gap-2">
              <p className="text-sm">
                {present === 0
                  ? "A aula será registrada sem presentes, com a observação informada."
                  : regular
                    ? "O relato compartilhado será salvo junto da chamada."
                    : present === 1
                      ? "1 relato individual será salvo junto da chamada."
                      : `${present} relatos individuais serão salvos junto da chamada.`}
              </p>
              {rows.some((row) => row.status === "ABSENT") && (
                <p className="text-caption text-muted-foreground">
                  Faltas:{" "}
                  {rows
                    .filter((row) => row.status === "ABSENT")
                    .map((row) => row.name)
                    .join(", ")}
                  .
                </p>
              )}
              {needsReason && <p className="whitespace-pre-wrap text-sm">Motivo: {reason}</p>}
            </div>
          </form>
        </TaskDialog>
      )}
    </>
  );
}
