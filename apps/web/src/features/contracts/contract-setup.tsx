"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import { ToastAlert, Button } from "@lazuli/ui";
import { parseDateBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import { contractInputFromFields } from "./contract-form-model";
import type { ContractFormState, ContractOperation } from "./new-contract-state";
import { validatePrice } from "./new-contract-state";
import {
  firstInvalidStep,
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
import { SetupSummary } from "./contract-setup-summary";
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
  material: "Selecione os livros e defina as condições de pagamento.",
  review: "Confira o combinado antes de concluir.",
};

function focusPanel(panel: HTMLDivElement | null, invalidOnly = false): void {
  requestAnimationFrame(() => {
    if (focusInvalidField(panel)) return;
    if (!invalidOnly) focusFirstField(panel);
  });
}

function focusInvalidField(panel: HTMLDivElement | null): boolean {
  const target = invalidTarget(panel);
  if (!target) return false;
  for (
    let ancestor = target.parentElement;
    ancestor && ancestor !== panel;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }
  target.focus();
  target.scrollIntoView({ block: "nearest" });
  return true;
}

function invalidTarget(panel: HTMLDivElement | null): HTMLElement | null | undefined {
  const invalid = panel?.querySelector<HTMLElement>('[aria-invalid="true"]');
  const bookIndex = invalid?.dataset.invalidBook;
  const emptyBook =
    bookIndex === undefined
      ? null
      : invalid?.querySelector<HTMLElement>(`[name="material-stage-${bookIndex}"]`);
  return (
    emptyBook ??
    invalid?.querySelector<HTMLElement>('input:not([type="hidden"]), button, textarea') ??
    invalid
  );
}

function focusFirstField(panel: HTMLDivElement | null): void {
  panel?.scrollTo({ top: 0 });
  panel?.closest("form")?.scrollTo({ top: 0 });
  const first =
    panel?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, [data-slot="segmented-control"] button',
    ) ?? panel?.querySelector<HTMLElement>("h2");
  first?.focus({ preventScroll: true });
}

type SubmitContext = {
  props: Props;
  fields: FormProps["fields"];
  material: SetupMaterial;
  step: SetupStep;
  index: number;
  go: (step: SetupStep) => void;
  panel: RefObject<HTMLDivElement | null>;
  setDueError: (value: string) => void;
};

function billingDueIsInvalid({
  props,
  fields,
  step,
}: Pick<SubmitContext, "props" | "fields" | "step">): boolean {
  if (!props.billingFirstDueDate || (step !== "parties" && step !== "review")) return false;
  const due = parseDateBR(props.billingFirstDueDate.value);
  const start = parseDateBR(fields.firstDueDate);
  return !due || Boolean(start && due < start);
}

function collectSetupErrors({
  props,
  fields,
  material,
  step,
}: Pick<SubmitContext, "props" | "fields" | "material" | "step">): ReturnType<
  typeof setupValidation
> {
  const { state, offer } = props;
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
  if (props.deferStudentValidation) removeStudentErrors(all);
  return step === "review"
    ? all
    : Object.fromEntries(Object.entries(all).filter(([key]) => stepForField(key) === step));
}

function removeStudentErrors(errors: ReturnType<typeof setupValidation>): void {
  for (const key of Object.keys(errors))
    if (key.startsWith("student")) delete errors[key as keyof typeof errors];
}

function createSubmitHandler(context: SubmitContext): (event: FormEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const { props, fields, material, step, index, go, panel, setDueError } = context;
    if (props.pending || !props.offer.data) return;
    if (billingDueIsInvalid({ props, fields, step })) {
      setDueError("Informe um vencimento válido a partir do início do contrato.");
      go("parties");
      focusPanel(panel.current, true);
      return;
    }
    setDueError("");
    const errors = collectSetupErrors({ props, fields, material, step });
    props.state.setErrors(errors);
    const invalidStep = firstInvalidStep(errors);
    if (invalidStep) {
      go(invalidStep);
      focusPanel(panel.current, true);
      return;
    }
    if (step === "review") void props.onComplete(event);
    else go(setupSteps[index + 1] ?? "review");
  };
}

function useSetupData(props: Props): {
  fields: FormProps["fields"];
  material: SetupMaterial;
  preview: FormProps["preview"];
  formProps: FormProps;
} {
  const { state, offer } = props;
  const fields = props.fields ?? state.fields;
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
  return { fields, material, preview, formProps };
}

export function ContractSetup(props: Props): ReactElement {
  const { fields, material, preview, formProps } = useSetupData(props);
  const [step, setStep] = useState<SetupStep>("parties");
  const [dueError, setDueError] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const index = setupSteps.indexOf(step);
  useEffect(() => focusPanel(panel.current), [step]);
  const go = (next: SetupStep): void => {
    if (props.pending) return;
    setSummaryOpen(false);
    if (next === step) return;
    setStep(next);
  };
  const submit = createSubmitHandler({
    props,
    fields,
    material,
    step,
    index,
    go,
    panel,
    setDueError,
  });
  return (
    <SetupLayout
      {...{
        props,
        fields,
        material,
        preview,
        formProps,
        step,
        dueError,
        summaryOpen,
        panel,
        id,
        index,
        go,
        submit,
      }}
      onToggleSummary={() => setSummaryOpen(!summaryOpen)}
      onClearDueError={() => setDueError("")}
    />
  );
}

type SetupLayoutProps = {
  props: Props;
  fields: FormProps["fields"];
  material: SetupMaterial;
  preview: FormProps["preview"];
  formProps: FormProps;
  step: SetupStep;
  dueError: string;
  summaryOpen: boolean;
  panel: RefObject<HTMLDivElement | null>;
  id: string;
  index: number;
  go: (step: SetupStep) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleSummary: () => void;
  onClearDueError: () => void;
};

function SetupLayout({
  props,
  fields,
  material,
  preview,
  formProps,
  step,
  dueError,
  summaryOpen,
  panel,
  id,
  index,
  go,
  submit,
  onToggleSummary,
  onClearDueError,
}: SetupLayoutProps): ReactElement {
  return (
    <div className={styles.root} ref={props.state.popup}>
      <form id={id} noValidate onSubmit={submit} className={styles.layout}>
        <SetupAside
          id={id}
          fields={fields}
          preview={preview}
          material={material}
          step={step}
          pending={props.pending}
          onEdit={go}
          open={summaryOpen}
          onToggle={onToggleSummary}
        />
        <SetupPanel
          panel={panel}
          step={step}
          index={index}
          props={props}
          formProps={formProps}
          material={material}
          dueError={dueError}
          onClearDueError={onClearDueError}
          onEdit={go}
        />
      </form>
      <SetupFooter id={id} step={step} index={index} props={props} onEdit={go} />
    </div>
  );
}

type SetupNavigation = (step: SetupStep) => void;

function SetupAside({
  id,
  fields,
  preview,
  material,
  step,
  pending,
  onEdit,
  open,
  onToggle,
}: {
  id: string;
  fields: FormProps["fields"];
  preview: FormProps["preview"];
  material: SetupMaterial;
  step: SetupStep;
  pending: boolean;
  onEdit: SetupNavigation;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <aside className={styles.summary} data-expanded={open}>
      <div className={styles.summaryHeading}>
        <h2>Resumo do contrato</h2>
      </div>
      <button
        type="button"
        className={styles.summaryToggle}
        aria-expanded={open}
        aria-controls={`${id}-summary`}
        onClick={onToggle}
      >
        Resumo do contrato <ChevronDown aria-hidden="true" />
      </button>
      <div id={`${id}-summary`} className={styles.summaryContents}>
        <SetupSummary
          fields={fields}
          preview={preview}
          material={material}
          step={step}
          onEdit={onEdit}
          pending={pending}
        />
      </div>
    </aside>
  );
}

type PanelProps = {
  panel: RefObject<HTMLDivElement | null>;
  step: SetupStep;
  index: number;
  props: Props;
  formProps: FormProps;
  material: SetupMaterial;
  dueError: string;
  onClearDueError: () => void;
  onEdit: SetupNavigation;
};

function SetupPanel({
  panel,
  step,
  index,
  props,
  formProps,
  material,
  dueError,
  onClearDueError,
  onEdit,
}: PanelProps): ReactElement {
  return (
    <div className={styles.panel} ref={panel}>
      <div key={step} className={styles.stepSlide}>
        <SetupHeader
          step={step}
          index={index}
          pending={props.pending}
          onRestoreTerms={props.onRestoreTerms}
          onClearDueError={onClearDueError}
        />
        <OfferFeedback offer={props.offer} />
        <fieldset disabled={props.pending} className={styles.step}>
          <SetupStepFields
            step={step}
            props={props}
            formProps={formProps}
            material={material}
            dueError={dueError}
            onEdit={onEdit}
          />
        </fieldset>
        {(props.error || props.state.submissionError) && (
          <ToastAlert variant="destructive">
            {props.error || props.state.submissionError}
          </ToastAlert>
        )}
      </div>
    </div>
  );
}

function SetupHeader({
  step,
  index,
  pending,
  onRestoreTerms,
  onClearDueError,
}: {
  step: SetupStep;
  index: number;
  pending: boolean;
  onRestoreTerms: Props["onRestoreTerms"];
  onClearDueError: () => void;
}): ReactElement {
  return (
    <header className={styles.panelHeading}>
      <div>
        <h2 tabIndex={-1}>{setupTitles[step]}</h2>
        <p>{introductions[step]}</p>
      </div>
      <div className="flex items-center gap-3">
        {step === "parties" && onRestoreTerms && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => {
              onRestoreTerms();
              onClearDueError();
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
  );
}

function SetupStepFields({
  step,
  props,
  formProps,
  material,
  dueError,
  onEdit,
}: {
  step: SetupStep;
  props: Props;
  formProps: FormProps;
  material: SetupMaterial;
  dueError: string;
  onEdit: SetupNavigation;
}): ReactElement | null {
  if (step === "parties")
    return (
      <SetupParties
        {...formProps}
        studentKnown={props.studentKnown ?? false}
        billingFirstDueDate={props.billingFirstDueDate}
        dueError={dueError}
      />
    );
  if (step === "tuition")
    return <SetupTuition {...formProps} allowEnrollmentFee={props.allowEnrollmentFee ?? false} />;
  if (step === "material")
    return (
      <SetupMaterialFields
        {...formProps}
        material={material}
        suggestedStageId={props.suggestedStageId}
        allowNoAcquisition={Boolean(props.renewedFromId)}
      />
    );
  if (step === "review")
    return (
      <SetupReview
        {...formProps}
        material={material}
        onEdit={onEdit}
        billingFirstDueDate={props.billingFirstDueDate?.value}
      />
    );
  return null;
}

function nextButtonLabel(step: SetupStep, completeLabel: string): string {
  if (step === "review") return completeLabel;
  if (step === "material") return "Conferir contrato";
  return "Continuar";
}

function SetupFooter({
  id,
  step,
  index,
  props,
  onEdit,
}: {
  id: string;
  step: SetupStep;
  index: number;
  props: Props;
  onEdit: SetupNavigation;
}): ReactElement {
  const back = (): void => {
    if (index === 0) props.onBack();
    else onEdit(setupSteps[index - 1] ?? "parties");
  };
  return (
    <div className={styles.footer}>
      {props.onSaveWithout ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={props.pending}
          onClick={props.onSaveWithout}
        >
          Salvar sem contrato
        </Button>
      ) : (
        <span />
      )}
      <div className={styles.footerActions}>
        <Button type="button" variant="secondary" disabled={props.pending} onClick={back}>
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
        <Button
          form={id}
          type="submit"
          loading={props.pending}
          disabled={props.pending || !props.offer.data}
        >
          {step === "review" ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {nextButtonLabel(step, props.completeLabel)}
        </Button>
      </div>
    </div>
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
      <ToastAlert variant="destructive">
        Não foi possível carregar as condições.{" "}
        <Button type="button" variant="link" onClick={() => void offer.refetch()}>
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  if (!offer.data)
    return (
      <ToastAlert variant="warning" toastTimeout={0}>
        Configure as condições financeiras em Ajustes para criar o contrato.
      </ToastAlert>
    );
  return null;
}
