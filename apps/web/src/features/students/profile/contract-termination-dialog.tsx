"use client";

import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { terminationFeeCents } from "@lazuli/domain";
import { contractTerminationConfirmSchema } from "@lazuli/validators";
import { Alert, Button, Checkbox, CurrencyInput, Field, Input, Label, Textarea } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";

const MAX_TERMINATION_FEE_PERCENT = 100;

type Preview = RouterOutputs["finance"]["previewTermination"];

export function ContractTerminationDialog({
  contractId,
  onClose,
}: {
  contractId: string;
  onClose: () => void;
}): ReactJSX.Element {
  const preview = trpc.finance.previewTermination.useQuery(
    { contractId },
    { retry: false, refetchOnWindowFocus: false },
  );
  if (preview.data)
    return (
      <TerminationForm
        key={preview.data.version}
        preview={preview.data}
        onClose={onClose}
        onRefresh={() => {
          void preview.refetch();
        }}
      />
    );
  return (
    <TaskDialog
      title="Rescindir contrato e encerrar matrícula"
      description="Confira o acerto antes de confirmar."
      onClose={onClose}
      pending={false}
      formId="termination-loading"
      firstField=""
      submitLabel="Revisar rescisão"
      submitIcon={<ArrowRight aria-hidden="true" />}
      cancelIcon={<X aria-hidden="true" />}
      submitDisabled
      error={preview.error?.message}
    >
      {preview.isPending ? (
        <p className="text-sm text-muted-foreground">Calculando valores em aberto…</p>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            void preview.refetch();
          }}
        >
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </TaskDialog>
  );
}

function TerminationForm({
  preview,
  onClose,
  onRefresh,
}: {
  preview: Preview;
  onClose: () => void;
  onRefresh: () => void;
}): ReactJSX.Element {
  const utils = trpc.useUtils();
  const [commandId] = useState(() => crypto.randomUUID());
  const [fee, setFee] = useState(String(preview.defaultFeePct));
  const [charges, setCharges] = useState<number | null>(preview.chargesCents);
  const [dueDate, setDueDate] = useState(preview.today);
  const [enrollmentIds, setEnrollmentIds] = useState(
    preview.enrollments.filter((row) => !row.scheduledChanges).map((row) => row.id),
  );
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string>();
  const [enrollmentError, setEnrollmentError] = useState<string>();
  const mutation = trpc.finance.confirmTermination.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      onClose();
    },
  });
  const feePct = Number(fee.replace(",", "."));
  const retainedChargesCents = charges ?? 0;
  const validFee =
    fee.trim() !== "" &&
    Number.isFinite(feePct) &&
    feePct >= 0 &&
    feePct <= MAX_TERMINATION_FEE_PERCENT;
  const feeCents = validFee ? terminationFeeCents(preview.openPrincipalCents, feePct) : 0;
  const total =
    preview.overduePrincipalCents +
    (Number.isFinite(retainedChargesCents) ? retainedChargesCents : 0) +
    feeCents;
  const selected = preview.enrollments.filter((row) => enrollmentIds.includes(row.id));
  const nameConfirmed = confirmationName.trim() === preview.studentName.trim();

  return (
    <TaskDialog
      title="Rescindir contrato e encerrar matrícula"
      description={preview.studentName}
      onClose={onClose}
      pending={mutation.isPending}
      formId="contract-termination"
      firstField="termination-fee"
      size="wide"
      compactHeader
      actionSize="sm"
      contentClassName="md:w-[calc(100vw-3rem)] md:max-w-[1120px] [&>[data-slot=dialog-footer]]:mt-4"
      bodyClassName="pt-3"
      submitLabel={review ? "Rescindir e encerrar" : "Revisar rescisão"}
      submitIcon={review ? <TriangleAlert aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
      cancelIcon={<X aria-hidden="true" />}
      backIcon={<ArrowLeft aria-hidden="true" />}
      submitVariant={review ? "destructive" : "primary"}
      submitDisabled={review && (!acknowledged || !nameConfirmed)}
      onBack={
        review
          ? () => {
              setReview(false);
              setAcknowledged(false);
              setConfirmationName("");
              mutation.reset();
            }
          : undefined
      }
    >
      <form
        id="contract-termination"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          setEnrollmentError(undefined);
          if (review && !nameConfirmed) {
            setError("Digite o nome completo do aluno para confirmar a rescisão.");
            return;
          }
          const parsed = contractTerminationConfirmSchema.safeParse({
            contractId: preview.contractId,
            commandId,
            version: preview.version,
            feePct,
            retainedChargesCents,
            dueDate,
            enrollmentIds,
            reason,
            acknowledged: review ? acknowledged : true,
          });
          if (!validFee || charges === null || !parsed.success) {
            setError(
              parsed.success
                ? "Informe a multa e os encargos negociados."
                : parsed.error.issues[0]?.message,
            );
            return;
          }
          if (retainedChargesCents > preview.chargesCents) {
            setError("Os encargos negociados não podem superar os encargos apurados.");
            return;
          }
          if (dueDate < preview.today) {
            setError("O vencimento deve ser hoje ou uma data futura.");
            return;
          }
          if (preview.enrollments.length > 0 && selected.length === 0) {
            setEnrollmentError("Selecione a matrícula que será encerrada.");
            return;
          }
          if (selected.some((row) => row.scheduledChanges)) {
            setEnrollmentError("Resolva a programação desta matrícula antes de continuar.");
            return;
          }
          if (!review) {
            setReview(true);
            return;
          }
          mutation.mutate(parsed.data);
        }}
      >
        <Alert variant="destructive" className="py-2 text-caption">
          <strong>Atenção: esta ação é irreversível.</strong>
          <p>
            Ao confirmar, o contrato será rescindido e as matrículas selecionadas serão encerradas
            em {formatDateOnlyBR(preview.today)}.
          </p>
          <p>
            Os pagamentos já recebidos continuarão no histórico. Não haverá reembolso automático.
          </p>
        </Alert>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section
            className="grid min-w-0 content-start gap-3 md:border-r md:pr-4"
            aria-labelledby="termination-summary"
          >
            <h3 id="termination-summary" className="text-sm font-semibold">
              Resumo do acerto
            </h3>
            <dl className="grid gap-2.5 text-sm">
              <Amount
                label="Principal em aberto · base da multa"
                cents={preview.openPrincipalCents}
              />
              <Amount label="Principal vencido mantido" cents={preview.overduePrincipalCents} />
              <Amount
                label="Principal futuro dispensado"
                cents={preview.waivedFuturePrincipalCents}
              />
              <Amount label={`Multa negociada (${validFee ? feePct : "—"}%)`} cents={feeCents} />
              <Amount
                label="Encargos mantidos"
                cents={Number.isFinite(retainedChargesCents) ? retainedChargesCents : 0}
              />
              <Amount label="Total do acerto" cents={total} total />
            </dl>
            <p className="text-caption text-muted-foreground">
              O acerto substitui as parcelas abertas. A multa considera todo o principal ainda não
              pago. Vencimentos de hoje entram no principal mantido.
            </p>
          </section>
          {review ? (
            <div className="grid min-w-0 content-start gap-3 text-sm">
              <h3 className="font-semibold">Confira o encerramento</h3>
              <p>
                <strong>Matrículas:</strong>{" "}
                {selected.map((row) => row.className).join(", ") || "Nenhuma matrícula ativa"}.
              </p>
              <p>
                <strong>Vencimento do acerto:</strong> {formatDateOnlyBR(dueDate)}.
              </p>
              <Field className="content-start">
                <Label htmlFor="termination-review-reason">Motivo e negociação</Label>
                <Textarea
                  id="termination-review-reason"
                  size="sm"
                  rows={2}
                  className="resize-none"
                  readOnly
                  value={reason}
                />
              </Field>
              <Field className="content-start">
                <Label htmlFor="termination-confirmation-name">Confirme o nome do aluno</Label>
                <p
                  id="termination-confirmation-help"
                  className="text-caption text-muted-foreground"
                >
                  Digite <strong className="text-foreground">{preview.studentName}</strong> para
                  confirmar a rescisão.
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
                  value={confirmationName}
                  onChange={(event) => setConfirmationName(event.target.value)}
                  placeholder="Nome completo do aluno"
                />
              </Field>
              <label className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={acknowledged}
                  onCheckedChange={setAcknowledged}
                />
                <span>
                  Conferi o acerto e autorizo rescindir o contrato e encerrar as matrículas
                  selecionadas.
                </span>
              </label>
            </div>
          ) : (
            <div className="grid min-w-0 content-start gap-3">
              <div className="grid gap-2">
                <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field className="content-start">
                    <Label htmlFor="termination-fee">Multa (%)</Label>
                    <Input
                      size="sm"
                      id="termination-fee"
                      inputMode="decimal"
                      value={fee}
                      onChange={(changeEvent) => setFee(changeEvent.target.value)}
                    />
                  </Field>
                  <Field className="content-start">
                    <Label htmlFor="termination-charges">Encargos (R$)</Label>
                    <CurrencyInput
                      size="sm"
                      id="termination-charges"
                      value={charges}
                      onValueChange={setCharges}
                    />
                  </Field>
                  <Field className="content-start">
                    <Label htmlFor="termination-due">Vencimento</Label>
                    <Input
                      size="sm"
                      id="termination-due"
                      type="date"
                      min={preview.today}
                      value={dueDate}
                      onChange={(changeEvent) => setDueDate(changeEvent.target.value)}
                    />
                  </Field>
                </div>
                <p className="text-caption text-muted-foreground">
                  Multa padrão: 20% · Encargos apurados: {money(preview.chargesCents)}. Ambos podem
                  ser reduzidos ou zerados.
                </p>
              </div>
              <fieldset
                className="grid content-start gap-1.5"
                aria-describedby={enrollmentError ? "termination-enrollment-error" : undefined}
              >
                <legend className="mb-1.5 text-sm font-medium">Matrículas a encerrar</legend>
                {preview.enrollments.length === 0 && (
                  <p className="text-caption text-muted-foreground">
                    Não há matrícula ativa para encerrar.
                  </p>
                )}
                {preview.enrollments.map((row) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-start gap-2 rounded-sm border px-2.5 py-2 text-sm has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-accent/30"
                  >
                    <Checkbox
                      className="mt-0.5"
                      aria-label={`Encerrar matrícula ${row.className}`}
                      invalid={Boolean(enrollmentError)}
                      checked={enrollmentIds.includes(row.id)}
                      onCheckedChange={(checked) => {
                        setEnrollmentError(undefined);
                        setEnrollmentIds((ids) =>
                          checked ? [...ids, row.id] : ids.filter((id) => id !== row.id),
                        );
                      }}
                    />
                    <span>
                      {row.className}
                      {row.scheduledChanges && (
                        <span className="block text-caption text-muted-foreground">
                          {row.scheduledExitDate
                            ? `Saída programada para ${formatDateOnlyBR(row.scheduledExitDate)}.`
                            : "Há uma alteração programada."}
                          {row.semesterPublished
                            ? " Desfaça a publicação em Próximo semestre antes de rescindir."
                            : " Resolva a programação antes de rescindir."}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {enrollmentError && (
                  <p
                    id="termination-enrollment-error"
                    role="alert"
                    className="text-caption text-destructive"
                  >
                    {enrollmentError}
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
              <Field className="content-start">
                <Label htmlFor="termination-reason">Motivo e condições negociadas</Label>
                <Textarea
                  id="termination-reason"
                  name="termination-reason"
                  size="sm"
                  rows={2}
                  className="resize-none"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo da rescisão e condições combinadas."
                />
              </Field>
            </div>
          )}
        </div>
        {(error ?? mutation.error?.message) && (
          <p role="alert" className="flex items-start gap-1.5 text-caption text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {error ?? mutation.error?.message}
          </p>
        )}
        {mutation.error && (
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            Atualizar prévia do acerto
          </Button>
        )}
      </form>
    </TaskDialog>
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
