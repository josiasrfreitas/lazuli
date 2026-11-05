"use client";

import type { ReactElement } from "react";
import { Button, Field, FieldError, FormSection, Input, Label } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import {
  ContractStudentField,
  EnrollmentFeeField,
  PriceFields,
  TermFields,
  type FormProps,
} from "./contract-form-fields";
import { durationFromDates } from "./contract-form-model";
import { TextField } from "./contract-text-field";
import { ContractScholarshipFields } from "./contract-scholarship-fields";
import { ContractPayerFields } from "./contract-payer-fields";
import { MaterialQuoteSummary, type SetupMaterial } from "./contract-setup-material";
import { setupPlanLabel, type SetupStep } from "./contract-setup-model";
import styles from "./contract-setup.module.css";

const CENTS_PER_REAL = 100;

export function SetupParties(
  props: FormProps & {
    studentKnown: boolean;
    billingFirstDueDate?: { value: string; onChange: (value: string) => void } | undefined;
    dueError?: string;
  },
): ReactElement {
  return (
    <div className={styles.fields}>
      {!props.studentKnown && (
        <FormSection title="Aluno">
          <ContractStudentField {...props} />
        </FormSection>
      )}
      <FormSection title="Responsável financeiro">
        <ContractPayerFields {...props} showCopyHint keepCopyVisible expanded />
      </FormSection>
      <FormSection title="Período do contrato">
        <div className={styles.dates}>
          <TermFields {...props} />
          {!props.billingFirstDueDate && (
            <TextField
              name="billingFirstDueDate"
              label="Primeiro vencimento"
              placeholder="dd/mm/aaaa"
              date
              maskedDate
              value={props.fields.billingFirstDueDate ?? props.fields.firstDueDate}
              error={props.errors.billingFirstDueDate}
              onChange={(value) => props.change("billingFirstDueDate", value)}
            />
          )}
        </div>
        {props.billingFirstDueDate && (
          <RenewalFirstDueDate
            value={props.billingFirstDueDate.value}
            onChange={props.billingFirstDueDate.onChange}
            error={props.dueError}
          />
        )}
      </FormSection>
    </div>
  );
}

function RenewalFirstDueDate({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactElement {
  return (
    <Field name="renewal-first-due" className="max-w-48">
      <Label>Primeiro vencimento</Label>
      <Input
        size="sm"
        name="renewal-first-due"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        value={value}
        invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

export function SetupTuition(
  props: FormProps & { allowEnrollmentFee?: boolean | undefined },
): ReactElement {
  return (
    <div className={styles.fields}>
      <ContractScholarshipFields {...props}>
        <PriceFields {...props} />
        <TuitionPaymentPlan {...props} />
        {props.allowEnrollmentFee !== false && <EnrollmentFeeField {...props} />}
      </ContractScholarshipFields>
      <TuitionPreview preview={props.preview} fields={props.fields} />
      <SchoolConditions {...props} />
    </div>
  );
}

function TuitionPaymentPlan({ fields, errors, change }: FormProps): ReactElement {
  const fullScholarship = fields.scholarshipMode === "FULL";
  const duration = durationFromDates(fields);
  const defaultCount = Number.isInteger(duration) && duration > 0 ? String(duration) : "";
  const count = fields.paymentPlan === "special" ? fields.installmentCount : defaultCount;
  return (
    <div className={styles.installmentField}>
      <Field name="installmentCount">
        <Label>Parcelas mensais</Label>
        <Input
          size="sm"
          name="installmentCount"
          autoComplete="off"
          placeholder="Ex.: 12"
          inputMode="numeric"
          disabled={fullScholarship}
          value={fullScholarship ? "0" : count}
          invalid={!fullScholarship && Boolean(errors.installmentCount)}
          onChange={(event) => {
            change("installmentCount", event.target.value);
            change("paymentPlan", event.target.value === defaultCount ? "common" : "special");
          }}
        />
        {!fullScholarship && errors.installmentCount && (
          <FieldError match>{errors.installmentCount}</FieldError>
        )}
      </Field>
    </div>
  );
}

function TuitionPreview({ preview, fields }: Pick<FormProps, "preview" | "fields">): ReactElement {
  const fullScholarship = fields.scholarshipMode === "FULL";
  return (
    <dl className={styles.tuitionTotal} aria-label="Resumo das mensalidades" aria-live="polite">
      <div>
        <dt>Pagamento</dt>
        <dd>{fullScholarship ? "Bolsa integral" : setupPlanLabel(preview)}</dd>
        {fullScholarship && <p>Sem cobrança de mensalidades.</p>}
      </div>
      <div>
        <dt>Total de mensalidades</dt>
        <dd>{preview ? money(preview.principalAmountCents) : "A definir"}</dd>
      </div>
      <div>
        <dt>Vigência</dt>
        <dd>
          {fields.firstDueDate && fields.endsOn
            ? `${fields.firstDueDate} → ${fields.endsOn}`
            : "Datas a definir"}
        </dd>
        {preview && preview.installments.length > 0 && (
          <p>Primeiro vencimento em {formatDateOnlyBR(preview.installments[0]?.dueDate)}</p>
        )}
      </div>
    </dl>
  );
}

function SchoolConditions({ offer, fields }: FormProps): ReactElement | null {
  if (!offer) return null;
  return (
    <details className={styles.disclosure}>
      <summary>Condições da escola</summary>
      <dl className={styles.reviewList}>
        <div>
          <dt>Mensalidade de referência</dt>
          <dd>{money(offer.tuitionCeilingCents)}</dd>
        </div>
        <div>
          <dt>Desconto máximo</dt>
          <dd>{offer.maximumDiscountPct.toLocaleString("pt-BR")}%</dd>
        </div>
        <div>
          <dt>Pontualidade</dt>
          <dd>
            {(fields.scholarshipMode === "NONE" ? offer.punctualityDiscountPct : 0).toLocaleString(
              "pt-BR",
            )}
            %
          </dd>
        </div>
        <div>
          <dt>Juros</dt>
          <dd>
            {offer.interestRatePctMonthly.toLocaleString("pt-BR")}% ao mês · proporcional aos dias
            (base de 30 dias)
          </dd>
        </div>
        <div>
          <dt>Multa rescisória</dt>
          <dd>{offer.cancellationFeePct.toLocaleString("pt-BR")}%</dd>
        </div>
      </dl>
    </details>
  );
}

export function SetupReview({
  fields,
  preview,
  material,
  onEdit,
  billingFirstDueDate,
}: FormProps & {
  material: SetupMaterial;
  onEdit: (step: SetupStep) => void;
  billingFirstDueDate?: string | undefined;
}): ReactElement {
  return (
    <div className={styles.fields}>
      <ReviewParties fields={fields} onEdit={onEdit} />
      <ReviewTuition fields={fields} preview={preview} onEdit={onEdit} />
      <ReviewMaterial
        fields={fields}
        material={material}
        onEdit={onEdit}
        billingFirstDueDate={billingFirstDueDate}
      />
      <p className={styles.help}>
        Ao concluir, as cobranças serão criadas. Registre os recebimentos quando forem pagos.
      </p>
    </div>
  );
}

function ReviewParties({
  fields,
  onEdit,
}: {
  fields: FormProps["fields"];
  onEdit: (step: SetupStep) => void;
}): ReactElement {
  return (
    <FormSection
      title="Responsável e período"
      action={
        <Button type="button" variant="text" size="inline" onClick={() => onEdit("parties")}>
          Editar
        </Button>
      }
    >
      <dl className={styles.reviewList}>
        <div>
          <dt>Aluno</dt>
          <dd>{fields.studentMode === "create" ? fields.studentDraftName : fields.studentName}</dd>
        </div>
        <div>
          <dt>Responsável financeiro</dt>
          <dd>{fields.payerMode === "create" ? fields.payerName : fields.payerLabel}</dd>
        </div>
        <div>
          <dt>Vigência</dt>
          <dd>
            {fields.firstDueDate} a {fields.endsOn}
          </dd>
        </div>
        <div>
          <dt>Acordo</dt>
          <dd>{fields.agreedOn}</dd>
        </div>
      </dl>
    </FormSection>
  );
}

function ReviewTuition({
  fields,
  preview,
  onEdit,
}: Pick<FormProps, "fields" | "preview"> & { onEdit: (step: SetupStep) => void }): ReactElement {
  const enrollmentFee = Math.round(Number(fields.enrollmentFee.replace(",", ".")) * CENTS_PER_REAL);
  return (
    <FormSection
      title="Mensalidades"
      action={
        <Button type="button" variant="text" size="inline" onClick={() => onEdit("tuition")}>
          Editar
        </Button>
      }
    >
      <div className={styles.reviewAmount}>
        <strong>{setupPlanLabel(preview)}</strong>
        {preview && <span>Total {money(preview.principalAmountCents)}</span>}
      </div>
      {fields.scholarshipMode !== "NONE" && (
        <p className={styles.help}>
          Bolsa de {fields.scholarshipMode === "FULL" ? "100" : fields.scholarshipPct}% ·{" "}
          {fields.scholarshipAgreement}
        </p>
      )}
      <p className={styles.help}>
        {enrollmentFee > 0
          ? `Taxa de matrícula ${money(enrollmentFee)} · vence em ${fields.agreedOn}`
          : "Sem taxa de matrícula"}
      </p>
      <ReviewSchedule preview={preview} />
    </FormSection>
  );
}

function ReviewSchedule({ preview }: Pick<FormProps, "preview">): ReactElement | null {
  if (!preview || preview.installments.length === 0) return null;
  return (
    <details className={styles.disclosure}>
      <summary>Ver vencimentos</summary>
      <table className={styles.calendar}>
        <caption className="sr-only">Cobranças das mensalidades</caption>
        <thead>
          <tr>
            <th scope="col">Parcela</th>
            <th scope="col">Vencimento</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {preview.installments.map((row) => (
            <tr key={row.sequenceNumber}>
              <td>{row.sequenceNumber}</td>
              <td>{formatDateOnlyBR(row.dueDate)}</td>
              <td>{money(row.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function ReviewMaterial({
  fields,
  material,
  onEdit,
  billingFirstDueDate,
}: {
  fields: FormProps["fields"];
  material: SetupMaterial;
  onEdit: (step: SetupStep) => void;
  billingFirstDueDate?: string | undefined;
}): ReactElement {
  const stageIds = fields.materialStageIds.split(",");
  const books = stageIds
    .map((id) => material.stages.data?.find((stage) => stage.id === id)?.internalCode)
    .filter(Boolean);
  return (
    <FormSection
      title="Material"
      action={
        <Button type="button" variant="text" size="inline" onClick={() => onEdit("material")}>
          Editar
        </Button>
      }
    >
      {fields.materialPayment === "NONE" ? (
        <p className={styles.help}>Sem nova aquisição.</p>
      ) : (
        <>
          <p className={styles.bookNames}>{books.join(" · ") || "Livros a definir"}</p>
          <MaterialQuoteSummary fields={fields} material={material} />
          {fields.materialScholarshipMode !== "NONE" && (
            <p className={styles.help}>
              Bolsa de{" "}
              {fields.materialScholarshipMode === "FULL" ? "100" : fields.materialScholarshipPct}% ·{" "}
              {fields.materialScholarshipAgreement}
            </p>
          )}
          {material.effective && material.effective.receivableCents > 0 && (
            <p className={styles.help}>
              Valor do material a receber: {money(material.effective.receivableCents)}, com
              vencimento em{" "}
              {billingFirstDueDate ?? fields.billingFirstDueDate ?? fields.firstDueDate}.
            </p>
          )}
        </>
      )}
    </FormSection>
  );
}
