"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { RouterInputs } from "@lazuli/api";
import { Field, Input, Label } from "@lazuli/ui";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { notifyCalendarExecution } from "./execution-notifications";
import { ImpactOverview, TeacherImpacts, OtherImpacts, type ImpactPreview } from "./impact-summary";
import type { CalendarChange } from "./change-form";
import styles from "./impact.module.css";

export function CalendarImpact({
  change,
  preview,
  onBack,
  onClose,
  onSaved,
  embedded = false,
  onPendingChange,
}: {
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  change: CalendarChange;
  preview: ImpactPreview;
  onBack: () => void;
  onClose: () => void;
  onSaved?: ((semesterId: string) => void) | undefined;
}): ReactElement {
  const [commandId] = useState(() => crypto.randomUUID());
  const [confirmationText, setConfirmationText] = useState("");
  const phrase = preview.confirmationPhrase;
  const confirmed = !phrase || confirmationText.trim().toLocaleUpperCase("pt-BR") === phrase;
  const confirm = useCalendarConfirmation({ onSaved, onClose, onPendingChange });
  return (
    <TaskDialog
      embedded={embedded}
      size="wide"
      actionSize="sm"
      title="Revisar alteração do calendário"
      description={preview.subject}
      formId="calendar-confirm"
      firstField="calendar-review-start"
      submitLabel={phrase ? "Cancelar atividades e aplicar" : "Aplicar alteração"}
      submitVariant={phrase ? "destructive" : "primary"}
      submitDisabled={!confirmed}
      pendingLabel="Aplicando calendário…"
      pending={confirm.isPending}
      onBack={onBack}
      onClose={onClose}
      error={confirm.error?.message}
    >
      <form
        id="calendar-confirm"
        className={styles.review}
        onSubmit={(event) => {
          event.preventDefault();
          if (confirm.isPending || !confirmed) return;
          confirm.mutate({ change, fingerprint: preview.fingerprint, commandId, confirmationText });
        }}
      >
        <div className={styles.content}>
          <ImpactOverview preview={preview} />
          <TeacherImpacts preview={preview} />
          <OtherImpacts preview={preview} />
        </div>
        <ImpactConfirmation
          phrase={phrase}
          confirmationText={confirmationText}
          setConfirmationText={setConfirmationText}
          pending={confirm.isPending}
          preserved={preview.preserved}
        />
      </form>
    </TaskDialog>
  );
}

function useCalendarConfirmation({
  onSaved,
  onClose,
  onPendingChange,
}: {
  onSaved: ((semesterId: string) => void) | undefined;
  onClose: () => void;
  onPendingChange: ((pending: boolean) => void) | undefined;
}): {
  isPending: boolean;
  error: { message: string } | null;
  mutate: (input: RouterInputs["calendar"]["academic"]["changes"]["confirm"]) => void;
} {
  const utils = trpc.useUtils();
  const confirm = trpc.calendar.academic.changes.confirm.useMutation({
    onSuccess: async (result) => {
      notifyCalendarExecution({
        id: result.id,
        state: result.dispatched ? "QUEUED" : "UNAVAILABLE",
        reason: result.reason,
      });
      await Promise.all([utils.calendar.invalidate(), utils.semesterOrganization.invalidate()]);
      if (result.semesterId) onSaved?.(result.semesterId);
      onClose();
    },
  });
  useEffect(() => {
    onPendingChange?.(confirm.isPending);
    return () => onPendingChange?.(false);
  }, [confirm.isPending, onPendingChange]);
  return confirm;
}

function ImpactConfirmation({
  phrase,
  confirmationText,
  setConfirmationText,
  pending,
  preserved,
}: {
  phrase: ImpactPreview["confirmationPhrase"];
  confirmationText: string;
  setConfirmationText: (value: string) => void;
  pending: boolean;
  preserved: number;
}): ReactElement {
  return (
    <aside className={styles.confirmation} aria-label="Confirmação da alteração">
      <div className={styles.confirmationTitle}>
        {phrase ? <ShieldAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        <h3>{phrase ? "Confirme os cancelamentos" : "Antes de aplicar"}</h3>
      </div>
      {phrase ? (
        <>
          <p>
            As atividades indicadas serão canceladas. A alteração não remarca essas aulas nem move
            os itens do planejamento.
          </p>
          <Field name="confirmationText">
            <Label htmlFor="calendar-confirmation">Para confirmar, digite a frase:</Label>
            <strong id="calendar-confirmation-phrase" className={styles.phrase}>
              {phrase}
            </strong>
            <Input
              id="calendar-confirmation"
              name="confirmationText"
              size="sm"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={160}
              aria-describedby="calendar-confirmation-phrase"
              placeholder="Digite a confirmação"
              value={confirmationText}
              disabled={pending}
              onChange={(event) => setConfirmationText(event.target.value)}
            />
          </Field>
        </>
      ) : (
        <p>Não há atividades futuras a cancelar. O calendário será atualizado ao confirmar.</p>
      )}
      {preserved > 0 && (
        <p className={styles.preserved}>
          <ShieldCheck aria-hidden="true" />
          <span>
            {preserved} registros passados, iniciados ou com informações registradas serão
            preservados.
          </span>
        </p>
      )}
      <p>A atualização das atividades poderá ser acompanhada na Agenda.</p>
    </aside>
  );
}
