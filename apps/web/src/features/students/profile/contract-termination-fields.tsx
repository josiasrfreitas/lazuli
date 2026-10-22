import type { JSX as ReactJSX } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Checkbox, CurrencyInput, Field, Input, Label, Textarea } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import type { TerminationPreview } from "./contract-termination-state";
import type { TerminationViewProps } from "./contract-termination-view";

export function TerminationDetails(props: TerminationViewProps): ReactJSX.Element {
  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <TerminationSummary {...props} />
      {props.state.review ? <TerminationReview {...props} /> : <TerminationEdit {...props} />}
    </div>
  );
}

function TerminationSummary({ preview, amounts }: TerminationViewProps): ReactJSX.Element {
  return (
    <section
      className="grid min-w-0 content-start gap-3 md:border-r md:pr-4"
      aria-labelledby="termination-summary"
    >
      <h3 id="termination-summary" className="text-sm font-semibold">
        Resumo do acerto
      </h3>
      <dl className="grid gap-2.5 text-sm">
        <Amount label="Principal em aberto · base da multa" cents={preview.openPrincipalCents} />
        <Amount label="Principal vencido mantido" cents={preview.overduePrincipalCents} />
        <Amount label="Principal futuro dispensado" cents={preview.waivedFuturePrincipalCents} />
        <Amount
          label={`Multa negociada (${amounts.validFee ? amounts.feePct : "—"}%)`}
          cents={amounts.feeCents}
        />
        <Amount
          label="Encargos mantidos"
          cents={Number.isFinite(amounts.retainedChargesCents) ? amounts.retainedChargesCents : 0}
        />
        <Amount label="Total do acerto" cents={amounts.total} total />
      </dl>
      <p className="text-caption text-muted-foreground">
        O acerto substitui as parcelas abertas. A multa considera todo o principal ainda não pago.
        Vencimentos de hoje entram no principal mantido.
      </p>
    </section>
  );
}

function TerminationReview(props: TerminationViewProps): ReactJSX.Element {
  const { preview, state, amounts } = props;
  return (
    <div className="grid min-w-0 content-start gap-3 text-sm">
      <h3 className="font-semibold">Confira o encerramento</h3>
      <p>
        <strong>Matrículas:</strong>{" "}
        {amounts.selected.map((row) => row.className).join(", ") || "Nenhuma matrícula ativa"}.
      </p>
      <p>
        <strong>Vencimento do acerto:</strong> {formatDateOnlyBR(state.dueDate)}.
      </p>
      <Field className="content-start">
        <Label htmlFor="termination-review-reason">Motivo e negociação</Label>
        <Textarea
          id="termination-review-reason"
          size="sm"
          rows={2}
          className="resize-none"
          readOnly
          value={state.reason}
        />
      </Field>
      <ReviewConfirmation preview={preview} state={state} />
    </div>
  );
}

function ReviewConfirmation({
  preview,
  state,
}: Pick<TerminationViewProps, "preview" | "state">): ReactJSX.Element {
  return (
    <>
      <Field className="content-start">
        <Label htmlFor="termination-confirmation-name">Confirme o nome do aluno</Label>
        <p id="termination-confirmation-help" className="text-caption text-muted-foreground">
          Digite <strong className="text-foreground">{preview.studentName}</strong> para confirmar a
          rescisão.
        </p>
        <Input
          id="termination-confirmation-name"
          name="termination-confirmation-name"
          size="sm"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          required
          aria-describedby="termination-confirmation-help"
          value={state.confirmationName}
          onChange={(event) => state.setConfirmationName(event.target.value)}
          placeholder="Nome completo do aluno"
        />
      </Field>
      <label className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-2.5">
        <Checkbox
          className="mt-0.5"
          checked={state.acknowledged}
          onCheckedChange={state.setAcknowledged}
        />
        <span>
          Conferi o acerto e autorizo rescindir o contrato e encerrar as matrículas selecionadas.
        </span>
      </label>
    </>
  );
}

function TerminationEdit(props: TerminationViewProps): ReactJSX.Element {
  const { state } = props;
  return (
    <div className="grid min-w-0 content-start gap-3">
      <EditAmountFields {...props} />
      <EnrollmentChoices {...props} />
      <Field className="content-start">
        <Label htmlFor="termination-reason">Motivo e condições negociadas</Label>
        <Textarea
          id="termination-reason"
          name="termination-reason"
          size="sm"
          rows={2}
          className="resize-none"
          value={state.reason}
          onChange={(event) => state.setReason(event.target.value)}
          placeholder="Motivo da rescisão e condições combinadas."
        />
      </Field>
    </div>
  );
}

function EditAmountFields({ preview, state }: TerminationViewProps): ReactJSX.Element {
  return (
    <div className="grid gap-2">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field className="content-start">
          <Label htmlFor="termination-fee">Multa (%)</Label>
          <Input
            size="sm"
            id="termination-fee"
            inputMode="decimal"
            value={state.fee}
            onChange={(event) => state.setFee(event.target.value)}
          />
        </Field>
        <Field className="content-start">
          <Label htmlFor="termination-charges">Encargos (R$)</Label>
          <CurrencyInput
            size="sm"
            id="termination-charges"
            value={state.charges}
            onValueChange={state.setCharges}
          />
        </Field>
        <Field className="content-start">
          <Label htmlFor="termination-due">Vencimento</Label>
          <Input
            size="sm"
            id="termination-due"
            type="date"
            min={preview.today}
            value={state.dueDate}
            onChange={(event) => state.setDueDate(event.target.value)}
          />
        </Field>
      </div>
      <p className="text-caption text-muted-foreground">
        Multa padrão: 20% · Encargos apurados: {money(preview.chargesCents)}. Ambos podem ser
        reduzidos ou zerados.
      </p>
    </div>
  );
}

function EnrollmentChoices(props: TerminationViewProps): ReactJSX.Element {
  const { preview, state, onRefresh } = props;
  return (
    <fieldset
      className="grid content-start gap-1.5"
      aria-describedby={state.enrollmentError ? "termination-enrollment-error" : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">Matrículas a encerrar</legend>
      {preview.enrollments.length === 0 && (
        <p className="text-caption text-muted-foreground">Não há matrícula ativa para encerrar.</p>
      )}
      {preview.enrollments.map((row) => (
        <EnrollmentChoice key={row.id} row={row} state={state} />
      ))}
      {state.enrollmentError && (
        <p id="termination-enrollment-error" role="alert" className="text-caption text-destructive">
          {state.enrollmentError}
        </p>
      )}
      {preview.enrollments.some((row) => row.semesterPublished) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href="/proximo-semestre"
            target="_blank"
            rel="noreferrer"
            className="text-caption font-medium text-primary underline underline-offset-2"
          >
            Revisar próximo semestre
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" /> Atualizar matrículas
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function EnrollmentChoice({
  row,
  state,
}: {
  row: TerminationPreview["enrollments"][number];
  state: TerminationViewProps["state"];
}): ReactJSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-sm border px-2.5 py-2 text-sm has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-accent/30">
      <Checkbox
        className="mt-0.5"
        aria-label={`Encerrar matrícula ${row.className}`}
        invalid={Boolean(state.enrollmentError)}
        checked={state.enrollmentIds.includes(row.id)}
        onCheckedChange={(checked) => {
          state.setEnrollmentError(undefined);
          state.setEnrollmentIds((ids) =>
            checked ? [...ids, row.id] : ids.filter((id) => id !== row.id),
          );
        }}
      />
      <span>
        {row.className}
        {row.scheduledChanges && <EnrollmentScheduleWarning row={row} />}
      </span>
    </label>
  );
}

function EnrollmentScheduleWarning({
  row,
}: {
  row: TerminationPreview["enrollments"][number];
}): ReactJSX.Element {
  return (
    <span className="block text-caption text-muted-foreground">
      {row.scheduledExitDate
        ? `Saída programada para ${formatDateOnlyBR(row.scheduledExitDate)}.`
        : "Há uma alteração programada."}
      {row.semesterPublished
        ? " Desfaça a publicação em Próximo semestre antes de rescindir."
        : " Resolva a programação antes de rescindir."}
    </span>
  );
}

function Amount({
  label,
  cents,
  total = false,
}: {
  label: string;
  cents: number;
  total?: boolean;
}): ReactJSX.Element {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${total ? "mt-1 border-t pt-3 font-semibold" : ""}`}
    >
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums">{money(cents)}</dd>
    </div>
  );
}
