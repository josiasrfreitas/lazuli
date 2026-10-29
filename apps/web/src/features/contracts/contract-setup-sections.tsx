"use client";

import type { ReactElement } from "react";
import {
  Button,
  Field,
  FieldError,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import {
  ContractStudentField,
  EnrollmentFeeField,
  PriceFields,
  TermFields,
  type FormProps,
} from "./contract-form-fields";
import { ContractPayerFields } from "./contract-payer-fields";
import {
  MaterialQuoteSummary,
  SetupScholarship,
  type SetupMaterial,
} from "./contract-setup-material";
import { setupPlanLabel, type SetupStep } from "./contract-setup-model";
import styles from "./contract-setup.module.css";

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
        </div>
        {props.billingFirstDueDate ? (
          <Field name="renewal-first-due" className="max-w-48">
            <Label>Primeiro vencimento</Label>
            <Input
              size="sm"
              name="renewal-first-due"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={props.billingFirstDueDate.value}
              invalid={Boolean(props.dueError)}
              onChange={(event) => props.billingFirstDueDate?.onChange(event.target.value)}
            />
            {props.dueError && <FieldError match>{props.dueError}</FieldError>}
          </Field>
        ) : (
          <p className={styles.help}>O primeiro vencimento será na data de início do contrato.</p>
        )}
      </FormSection>
    </div>
  );
}

export function SetupTuition(
  props: FormProps & { allowEnrollmentFee?: boolean | undefined },
): ReactElement {
  const { fields, errors, change, preview } = props;
  const special = fields.paymentPlan === "special";
  return (
    <div className={styles.fields}>
      <div className={styles.shortFields}>
        <PriceFields {...props} />
        {props.allowEnrollmentFee !== false && <EnrollmentFeeField {...props} />}
      </div>
      <SetupScholarship {...props} />
      {fields.scholarshipMode !== "FULL" && (
        <FormSection title="Pagamento das mensalidades">
          <SegmentedControl
            size="sm"
            wrap
            value={special ? "special" : "common"}
            onValueChange={(value) => {
              if (value) change("paymentPlan", value);
            }}
            aria-label="Parcelamento das mensalidades"
          >
            <SegmentedControlItem value="common">Uma parcela por mês</SegmentedControlItem>
            <SegmentedControlItem value="special">Definir quantidade</SegmentedControlItem>
          </SegmentedControl>
          {special && (
            <Field name="installmentCount" className="max-w-48">
              <Label>Quantidade de parcelas</Label>
              <Input
                size="sm"
                name="installmentCount"
                autoComplete="off"
                placeholder="Ex.: 6"
                inputMode="numeric"
                value={fields.installmentCount}
                invalid={Boolean(errors.installmentCount)}
                onChange={(event) => change("installmentCount", event.target.value)}
              />
              {errors.installmentCount && <FieldError match>{errors.installmentCount}</FieldError>}
            </Field>
          )}
          <p className={styles.help}>
            {special
              ? "O total é dividido nessa quantidade de parcelas mensais."
              : "As parcelas acompanham a duração do contrato."}
          </p>
        </FormSection>
      )}
      {preview && (
        <div className={styles.tuitionTotal} aria-live="polite">
          <strong>{setupPlanLabel(preview)}</strong>
          <span>
            {preview.installments.length
              ? `Total de mensalidades ${money(preview.principalAmountCents)}`
              : "Nenhuma cobrança de mensalidade será criada."}
          </span>
          {preview.installments.length > 0 && (
            <span className={styles.help}>
              De {formatDateOnlyBR(preview.installments[0]?.dueDate)} a{" "}
              {formatDateOnlyBR(preview.installments.at(-1)?.dueDate)}
            </span>
          )}
        </div>
      )}
      <SchoolConditions {...props} />
    </div>
  );
}

function SchoolConditions({ offer, fields }: FormProps): ReactElement | null {
  if (!offer) return null;
  return (
    <details className={styles.disclosure}>
      <summary>Condições da escola</summary>
      <dl className={styles.reviewList}>
        <div>
          <dt>Mensalidade máxima</dt>
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
  const enrollmentFee = Math.round(Number(fields.enrollmentFee.replace(",", ".")) * 100);
  const stageIds = fields.materialStageIds.split(",");
  const books = stageIds
    .map((id) => material.stages.data?.find((stage) => stage.id === id)?.internalCode)
    .filter(Boolean);
  return (
    <div className={styles.fields}>
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
            <dd>
              {fields.studentMode === "create" ? fields.studentDraftName : fields.studentName}
            </dd>
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
        {preview && preview.installments.length > 0 && (
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
        )}
      </FormSection>
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
                {fields.materialScholarshipMode === "FULL" ? "100" : fields.materialScholarshipPct}%
                · {fields.materialScholarshipAgreement}
              </p>
            )}
            {material.effective && material.effective.receivableCents > 0 && (
              <p className={styles.help}>
                Uma cobrança de {money(material.effective.receivableCents)} para a escola, com
                vencimento em {billingFirstDueDate ?? fields.firstDueDate}.
              </p>
            )}
          </>
        )}
      </FormSection>
      <p className={styles.help}>
        Ao concluir, as cobranças serão criadas. Registre os recebimentos quando forem pagos.
      </p>
    </div>
  );
}
