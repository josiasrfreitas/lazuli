"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { parseDateBR } from "~/lib/masks";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import { contractInputFromFields } from "./contract-form-model";
import type { ContractFormState, ContractOperation } from "./new-contract-state";
import { validatePrice } from "./new-contract-state";
import {
  firstInvalidStep,
  setupPlanLabel,
  setupSteps,
  setupTitles,
  setupTuitionPreview,
  setupValidation,
  stepForField,
  type SetupStep,
} from "./contract-setup-model";
import {
  SetupMaterialFields,
  useSetupMaterial,
  type SetupMaterial,
} from "./contract-setup-material";
import { SetupParties, SetupReview, SetupTuition } from "./contract-setup-sections";
import styles from "./contract-setup.module.css";

type Props = {
  state: ContractFormState;
  fields?: FormProps["fields"];
  offer: ContractOperation["offer"];
  pending: boolean;
  studentKnown?: boolean;
  renewedFromId?: string;
  allowEnrollmentFee?: boolean;
  billingFirstDueDate?: { value: string; onChange: (value: string) => void };
  deferStudentValidation?: boolean;
  parseInput?: () => ReturnType<typeof contractInputFromFields>;
  suggestedStageId?: string | null | undefined;
  error?: string | undefined;
  completeLabel: string;
  onComplete: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onBack: () => void;
  onRestoreTerms?: () => void;
  onSaveWithout?: () => void;
};

const introductions: Record<SetupStep, string> = {
  parties: "Defina quem paga e por quanto tempo vale o contrato.",
  tuition: "Combine os valores e as datas de cobrança do ensino.",
  material: "Escolha os livros e como será paga esta aquisição.",
  review: "Confira o combinado antes de concluir.",
};

function focusPanel(panel: HTMLDivElement | null, invalidOnly = false): void {
  requestAnimationFrame(() => {
    const invalid = panel?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const bookIndex = invalid?.dataset.invalidBook;
    const emptyBook =
      bookIndex === undefined
        ? null
        : invalid?.querySelector<HTMLElement>(`[name="material-stage-${bookIndex}"]`);
    const target =
      emptyBook ??
      invalid?.querySelector<HTMLElement>('input:not([type="hidden"]), button, textarea') ??
      invalid;
    if (target) {
      for (
        let ancestor = target.parentElement;
        ancestor && ancestor !== panel;
        ancestor = ancestor.parentElement
      ) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      }
      target.focus();
      target.scrollIntoView({ block: "nearest" });
      return;
    }
    if (!invalidOnly) {
      panel?.scrollTo({ top: 0 });
      panel?.closest("form")?.scrollTo({ top: 0 });
      const first =
        panel?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, [data-slot="segmented-control"] button',
        ) ?? panel?.querySelector<HTMLElement>("h2");
      first?.focus({ preventScroll: true });
    }
  });
}

export function ContractSetup(props: Props): ReactElement {
  const { state, offer, pending } = props;
  const fields = props.fields ?? state.fields;
  const [step, setStep] = useState<SetupStep>("parties");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [dueError, setDueError] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const material = useSetupMaterial({
    fields,
    change: state.change,
    suggestedStageId: props.suggestedStageId,
  });
  const preview = setupTuitionPreview({
    fields,
    offer: offer.data,
    billingFirstDueDate: props.billingFirstDueDate
      ? (parseDateBR(props.billingFirstDueDate.value) ?? undefined)
      : undefined,
  });
  const formProps: FormProps = {
    fields,
    errors: state.errors,
    change: state.change,
    offer: offer.data,
    preview,
    onMonthlyAmountBlur: () => validatePrice(state, offer.data),
  };
  const index = setupSteps.indexOf(step);
  useEffect(() => focusPanel(panel.current), [step]);
  const go = (next: SetupStep): void => {
    if (pending) return;
    setSummaryOpen(false);
    if (next === step) return;
    setDirection(setupSteps.indexOf(next) < index ? "backward" : "forward");
    setStep(next);
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (pending || !offer.data) return;
    if (props.billingFirstDueDate && (step === "parties" || step === "review")) {
      const due = parseDateBR(props.billingFirstDueDate.value);
      const start = parseDateBR(fields.firstDueDate);
      if (!due || (start && due < start)) {
        setDueError("Informe um vencimento válido a partir do início do contrato.");
        go("parties");
        focusPanel(panel.current, true);
        return;
      }
      setDueError("");
    }
    const all = setupValidation({
      fields,
      commandId: state.commandId.current,
      offer: offer.data,
      parsed:
        props.parseInput?.() ??
        contractInputFromFields(fields, state.commandId.current, props.renewedFromId),
    });
    if (fields.materialPayment !== "NONE" && material.installmentError)
      all.materialInstallments = material.installmentError;
    if (fields.materialPayment !== "NONE" && material.priceError)
      all.materialCustomPrice = material.priceError;
    if (props.deferStudentValidation)
      for (const key of Object.keys(all))
        if (key.startsWith("student")) delete all[key as keyof typeof all];
    const errors =
      step === "review"
        ? all
        : Object.fromEntries(Object.entries(all).filter(([key]) => stepForField(key) === step));
    state.setErrors(errors);
    const invalidStep = firstInvalidStep(errors);
    if (invalidStep) {
      go(invalidStep);
      focusPanel(panel.current, true);
      return;
    }
    if (step === "review") void props.onComplete(event);
    else go(setupSteps[index + 1] ?? "review");
  };
  return (
    <div className={styles.root} ref={state.popup}>
      <form id={id} noValidate onSubmit={submit} className={styles.layout}>
        <aside className={styles.summary} data-expanded={summaryOpen}>
          <div className={styles.summaryHeading}>
            <h2>Resumo do contrato</h2>
          </div>
          <button
            type="button"
            className={styles.summaryToggle}
            aria-expanded={summaryOpen}
            aria-controls={`${id}-summary`}
            onClick={() => setSummaryOpen(!summaryOpen)}
          >
            Resumo do contrato <ChevronDown aria-hidden="true" />
          </button>
          <div id={`${id}-summary`} className={styles.summaryContents}>
            <SetupSummary
              fields={fields}
              preview={preview}
              material={material}
              step={step}
              onEdit={go}
              pending={pending}
            />
          </div>
        </aside>
        <div className={styles.panel} ref={panel}>
          <div key={step} className={styles.stepSlide} data-direction={direction}>
            <header className={styles.panelHeading}>
              <div>
                <h2 tabIndex={-1}>{setupTitles[step]}</h2>
                <p>{introductions[step]}</p>
              </div>
              <div className="flex items-center gap-3">
                {step === "parties" && props.onRestoreTerms && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      props.onRestoreTerms?.();
                      setDueError("");
                    }}
                  >
                    Renovar termos
                  </Button>
                )}
                <span>
                  {index + 1} de {setupSteps.length}
                </span>
              </div>
            </header>
            <OfferFeedback offer={offer} />
            <fieldset disabled={pending} className={styles.step}>
              {step === "parties" && (
                <SetupParties
                  {...formProps}
                  studentKnown={props.studentKnown ?? false}
                  billingFirstDueDate={props.billingFirstDueDate}
                  dueError={dueError}
                />
              )}
              {step === "tuition" && (
                <SetupTuition
                  {...formProps}
                  allowEnrollmentFee={props.allowEnrollmentFee ?? false}
                />
              )}
              {step === "material" && (
                <SetupMaterialFields
                  {...formProps}
                  material={material}
                  suggestedStageId={props.suggestedStageId}
                  allowNoAcquisition={Boolean(props.renewedFromId)}
                />
              )}
              {step === "review" && (
                <SetupReview
                  {...formProps}
                  material={material}
                  onEdit={go}
                  billingFirstDueDate={props.billingFirstDueDate?.value}
                />
              )}
            </fieldset>
            {(props.error || state.submissionError) && (
              <Alert variant="destructive">{props.error || state.submissionError}</Alert>
            )}
          </div>
        </div>
      </form>
      <div className={styles.footer}>
        {props.onSaveWithout ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={props.onSaveWithout}
          >
            Salvar sem contrato
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.footerActions}>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => (index === 0 ? props.onBack() : go(setupSteps[index - 1] ?? "parties"))}
          >
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button form={id} type="submit" loading={pending} disabled={pending || !offer.data}>
            {step === "review" ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            {step === "review"
              ? props.completeLabel
              : step === "material"
                ? "Conferir contrato"
                : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SetupSummary({
  fields,
  preview,
  material,
  step,
  onEdit,
  pending,
}: Pick<FormProps, "fields" | "preview"> & {
  material: SetupMaterial;
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
  pending: boolean;
}): ReactElement {
  const payer = fields.payerMode === "create" ? fields.payerName : fields.payerLabel;
  const fee = Math.round(Number(fields.enrollmentFee.replace(",", ".")) * 100);
  const materialText =
    fields.materialPayment === "NONE"
      ? "Sem nova aquisição"
      : material.effective
        ? `${material.count} ${material.count === 1 ? "livro" : "livros"} · ${money(material.effective.chargedCents)}`
        : "Livros e valores a definir";
  const rows: Array<{
    step: SetupStep;
    title: string;
    value: string;
    detail?: string | undefined;
  }> = [
    {
      step: "parties",
      title: "Responsável e período",
      value: payer || "Responsável a definir",
      detail:
        fields.firstDueDate && fields.endsOn
          ? `${fields.firstDueDate} a ${fields.endsOn}`
          : "Período a definir",
    },
    {
      step: "tuition",
      title: "Mensalidades",
      value: setupPlanLabel(preview),
      detail: fee > 0 ? `Matrícula ${money(fee)}` : "Sem taxa de matrícula",
    },
    {
      step: "material",
      title: "Material",
      value: materialText,
      detail:
        fields.materialPayment === "NONE"
          ? undefined
          : fields.materialScholarshipMode === "FULL"
            ? "Bolsa integral"
            : fields.materialPayment === "CASH"
              ? "À vista · repasse"
              : `${fields.materialInstallments || "—"} parcelas · cartão · repasse`,
    },
    { step: "review", title: "Conferência", value: "Revisar o combinado" },
  ];
  return (
    <nav aria-label="Assuntos do contrato">
      <ol className={styles.summaryList}>
        {rows.map((row) => (
          <li key={row.step}>
            <button
              type="button"
              disabled={pending}
              aria-current={step === row.step ? "step" : undefined}
              onClick={() => onEdit(row.step)}
              className={styles.summaryItem}
            >
              <span className={styles.summaryLabel}>
                {row.title}
                <ChevronRight aria-hidden="true" />
              </span>
              <span className={styles.summaryValue}>{row.value}</span>
              {row.detail && <span className={styles.summaryDetail}>{row.detail}</span>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function OfferFeedback({ offer }: { offer: ContractOperation["offer"] }): ReactElement | null {
  if (offer.isPending)
    return (
      <p role="status" className={styles.help}>
        Carregando condições…
      </p>
    );
  if (offer.isError)
    return (
      <Alert variant="destructive">
        Não foi possível carregar as condições.{" "}
        <Button type="button" variant="link" onClick={() => void offer.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!offer.data)
    return (
      <Alert variant="warning">
        Configure as condições financeiras em Ajustes para criar o contrato.
      </Alert>
    );
  return null;
}
