"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent, type ReactElement } from "react";
import { Button, FormSection } from "@lazuli/ui";
import {
  exitRiskReasonLabels,
  formationCaseSchema,
  type FormationCaseInput,
} from "@lazuli/validators";
import { NarrativeField, TaskDialog, useValidation } from "~/features/shared/task-form";
import { formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { Choices, dateOnly } from "./shared";
import styles from "./organization.module.css";

type Kind = FormationCaseInput["kind"];
type Props = {
  id: string;
  semesterId: string;
  description: string;
  version?: number;
  financeHref?: string;
  hasRequest?: boolean;
  hasRisk?: boolean;
  hasBlock?: boolean;
  mode: "teacher" | "signal" | "intervention";
  onClose: () => void;
  onSaved: () => Promise<void>;
};
const narratives: Record<Kind, [string, string]> = {
  RISK: [
    "O que motivou a sinalização?",
    "Ex.: deixou de participar das atividades nas últimas aulas.",
  ],
  BLOCK: [
    "O que impede a continuidade na turma?",
    "Ex.: o novo horário de trabalho coincide com as aulas.",
  ],
  SCHEDULE_RISK: [
    "O que pode exigir uma troca de horário?",
    "Ex.: o aluno começa um novo turno de trabalho no próximo mês.",
  ],
  CHANGE_REQUEST: ["Relato do aluno", "O que foi conversado sobre a troca?"],
  RETRACT_REQUEST: ["O que mudou?", "Descreva por que o aluno retirou o pedido."],
  UNBLOCK: ["Como o impedimento foi resolvido?", "Ex.: a família conseguiu ajustar o horário."],
  CONTACT: ["Com quem e como foi a tentativa?", "Ex.: liguei para a responsável pelo aluno."],
  HANDOFF: ["Motivo do encaminhamento", "Ex.: a família pediu para rever o valor da mensalidade."],
  REVIEW: [
    "O que sustenta essa avaliação?",
    "Ex.: a família confirmou que consegue cumprir o acordo.",
  ],
  AGREEMENT: ["O que foi negociado?", "Ex.: a família combinou uma redução das parcelas."],
  NOTE: ["Observação da equipe", "Descreva o que precisa ficar registrado."],
};

function kindOptions(
  props: Pick<Props, "mode" | "hasBlock" | "hasRequest" | "hasRisk">,
): Partial<Record<Kind, string>> {
  const options: Partial<Record<Kind, string>> =
    props.mode === "signal"
      ? {
          RISK: "Risco de saída",
          SCHEDULE_RISK: "Risco de troca de horário",
          ...(props.hasBlock ? { UNBLOCK: "Resolver impedimento" } : {}),
        }
      : {
          CONTACT: "Contato",
          HANDOFF: "Encaminhamento",
          AGREEMENT: "Negociação",
          ...(props.hasRisk ? { REVIEW: "Reavaliação do risco" } : {}),
          CHANGE_REQUEST: "Pedido de troca",
          ...(props.hasRequest ? { RETRACT_REQUEST: "Retirar pedido" } : {}),
          NOTE: "Observação",
        };
  return options;
}

export function CaseForm(props: Props): ReactElement {
  const validation = useValidation();
  const saved = async (): Promise<void> => {
    await props.onSaved();
    props.onClose();
  };
  const staff = trpc.semesterOrganization.recordCase.useMutation({ onSuccess: saved });
  const teacher = trpc.teacherWorkspace.signalFormationRisk.useMutation({ onSuccess: saved });
  const pending = staff.isPending || teacher.isPending;
  const title = {
    teacher: "Sinalizar risco de saída",
    signal: "Sinalizar risco",
    intervention: "Registrar intervenção",
  }[props.mode];
  return (
    <TaskDialog
      title={title}
      compactHeader
      actionSize="sm"
      description={props.description}
      formId="formation-case"
      firstField={props.mode === "teacher" ? "riskReason" : "case-kind"}
      submitLabel="Registrar"
      onClose={props.onClose}
      pending={pending}
      bodyRef={validation.body}
      error={staff.error?.message ?? teacher.error?.message}
    >
      <CaseEntryForm
        {...props}
        pending={pending}
        validation={validation}
        onSave={(input) => {
          if (input.kind === "RISK" && props.mode === "teacher") teacher.mutate(input);
          else staff.mutate(input);
        }}
      />
    </TaskDialog>
  );
}

type EntryProps = Pick<
  Props,
  "mode" | "id" | "semesterId" | "version" | "hasBlock" | "hasRequest" | "hasRisk" | "financeHref"
> & {
  pending: boolean;
  validation: ReturnType<typeof useValidation>;
  onSave: (input: FormationCaseInput) => void;
};
const emptyDraft = {
  narrative: "",
  outcome: "",
  nextOwner: "",
  riskReason: "",
  verbalReport: "",
  reassessment: "",
  reference: "",
};
type Draft = typeof emptyDraft;
type DraftField = keyof Draft;
type FieldBinding = {
  name: DraftField;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
};
type FieldsProps = { kind: Kind; field: (name: DraftField) => FieldBinding };
function financialReference(
  value: string,
): { type: string | undefined; id: string | undefined } | undefined {
  if (!value) return undefined;
  const [type, id] = value.split(":");
  return { type, id };
}

function caseInput(values: {
  kind: Kind;
  draft: Draft;
  id: string;
  semesterId: string;
  eventId: string;
  version: number | undefined;
}): object {
  const { kind, draft, version, ...base } = values;
  const shared = { ...base, kind, narrative: draft.narrative };
  const reference = financialReference(draft.reference);
  switch (kind) {
    case "RISK": {
      return {
        ...shared,
        riskReason: draft.riskReason || undefined,
        verbalReport: draft.verbalReport ? draft.verbalReport === "yes" : undefined,
      };
    }
    case "CONTACT": {
      return { ...shared, outcome: draft.outcome };
    }
    case "HANDOFF": {
      return { ...shared, outcome: draft.outcome, nextOwner: draft.nextOwner, reference };
    }
    case "AGREEMENT": {
      return { ...shared, reference };
    }
    case "REVIEW": {
      return { ...shared, version, reassessment: draft.reassessment };
    }
    case "CHANGE_REQUEST":
      return { ...shared, version, outcome: draft.outcome };
    case "SCHEDULE_RISK":
    case "RETRACT_REQUEST":
    case "BLOCK":
    case "UNBLOCK": {
      return { ...shared, version };
    }
    case "NOTE": {
      return shared;
    }
  }
}

export function CaseEntryForm(props: EntryProps): ReactElement {
  const [kind, setKind] = useState<Kind>(props.mode === "intervention" ? "CONTACT" : "RISK");
  const [drafts, setDrafts] = useState<Partial<Record<Kind, Draft>>>({});
  const [eventId] = useState(() => crypto.randomUUID());
  const draft = drafts[kind] ?? emptyDraft;
  const options = kindOptions(props);
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (props.pending) return;
    const base = { id: props.id, semesterId: props.semesterId, eventId };
    const input = props.validation.validate(
      formationCaseSchema,
      caseInput({ kind, draft, ...base, version: props.version }),
    );
    if (input) props.onSave(input);
  }
  function field(name: DraftField): FieldBinding {
    return {
      name,
      value: draft[name],
      error: props.validation.errors[name],
      onChange: (value) => {
        setDrafts((previous) => ({
          ...previous,
          [kind]: { ...(previous[kind] ?? emptyDraft), [name]: value },
        }));
        props.validation.clear(name);
      },
    };
  }
  function chooseKind(next: string): void {
    setKind(next as Kind);
    for (const fieldName of Object.keys(props.validation.errors)) props.validation.clear(fieldName);
  }
  return (
    <form id="formation-case" className={styles.form} noValidate onSubmit={submit}>
      {props.mode !== "teacher" && (
        <SelectControl
          name="case-kind"
          label="Tipo de registro"
          value={kind}
          choices={Object.entries(options).map(([value, label]) => ({ value, label }))}
          onChange={chooseKind}
        />
      )}
      <FormSection title={props.mode === "teacher" ? "Sinalização" : options[kind]}>
        <EventFields kind={kind} field={field} />
        {(kind === "HANDOFF" || kind === "AGREEMENT") && (
          <div className="grid justify-items-start gap-2">
            <FinanceChoice id={props.id} required={kind === "AGREEMENT"} {...field("reference")} />
            {props.financeHref && (
              <Button
                size="sm"
                variant="link"
                nativeButton={false}
                render={
                  <Link
                    href={props.financeHref}
                    target="_blank"
                    rel="noopener"
                    aria-label="Abrir Financeiro em outra aba"
                  />
                }
              >
                Abrir Financeiro <ArrowUpRight />
              </Button>
            )}
          </div>
        )}
      </FormSection>
    </form>
  );
}

function EventFields({ kind, field }: FieldsProps): ReactElement {
  const [label, placeholder] = narratives[kind];
  return (
    <>
      {kind === "RISK" && (
        <SelectControl
          {...field("riskReason")}
          value={field("riskReason").value || "unknown"}
          onChange={(value) => field("riskReason").onChange(value === "unknown" ? "" : value)}
          label="Motivo do risco de saída"
          choices={[
            { value: "unknown", label: "Ainda não identificado" },
            ...Object.entries(exitRiskReasonLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
      )}
      {kind === "RISK" && (
        <Choices
          {...field("verbalReport")}
          label="O aluno ou a família falou em sair?"
          options={{ yes: "Sim", no: "Não" }}
        />
      )}
      {kind === "CHANGE_REQUEST" && (
        <Choices
          {...field("outcome")}
          label="Motivo da troca"
          options={{ Horário: "Horário", Modalidade: "Modalidade", Adaptação: "Adaptação" }}
        />
      )}
      {kind === "REVIEW" && (
        <Choices
          {...field("reassessment")}
          label="Como está o risco de saída?"
          options={{ CONTINUES: "Continua", CHANGED: "Mudou", RESOLVED: "Resolvido" }}
          error={field("reassessment").error && "Selecione a situação do risco."}
        />
      )}
      <NarrativeField {...field("narrative")} label={label} placeholder={placeholder} />
      {kind === "HANDOFF" && (
        <TextControl
          {...field("nextOwner")}
          label="Quem assume o próximo passo?"
          placeholder="Nome da pessoa ou equipe"
        />
      )}
      {(kind === "CONTACT" || kind === "HANDOFF") && (
        <NarrativeField
          {...field("outcome")}
          rows={2}
          label={kind === "CONTACT" ? "Resultado da tentativa" : "Próximo passo combinado"}
          placeholder={
            kind === "CONTACT"
              ? "Ex.: ligação sem resposta."
              : "Ex.: o Financeiro retorna à família até sexta-feira."
          }
        />
      )}
    </>
  );
}

function FinanceChoice({
  id,
  value,
  required,
  error,
  onChange,
}: {
  id: string;
  required: boolean;
  error?: string | undefined;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  const records = trpc.semesterOrganization.caseFinance.useQuery(
    { id },
    { refetchOnWindowFocus: "always" },
  );
  if (records.isPending) return <p role="status">Buscando negociações…</p>;
  if (records.isError)
    return (
      <Button type="button" size="sm" variant="link" onClick={() => void records.refetch()}>
        Tentar carregar negociações
      </Button>
    );
  if (records.data.agreements.length === 0 && records.data.renewals.length === 0)
    return <EmptyFinance required={required} error={error} />;
  const choices = [
    ...(required ? [] : [{ value: "none", label: "Sem vínculo financeiro" }]),
    ...records.data.agreements.map((item) => ({
      value: `renegotiation:${item.id}`,
      label: `Renegociação de ${formatDateOnlyBR(dateOnly(item.effectiveDate))} · ${item.reason}`,
    })),
    ...records.data.renewals.map((item) => ({
      value: `renewal:${item.id}`,
      label: `Renovação · ${item.startsOn ? formatDateOnlyBR(dateOnly(item.startsOn)) : "sem início informado"}`,
    })),
  ];
  return (
    <SelectControl
      name="case-finance"
      label={required ? "Negociação vinculada" : "Negociação vinculada · opcional"}
      error={error && "Escolha a negociação deste aluno."}
      value={value || (required ? "" : "none")}
      choices={choices}
      onChange={(next) => onChange(next === "none" ? "" : next)}
    />
  );
}

function EmptyFinance({
  required,
  error,
}: {
  required: boolean;
  error: string | undefined;
}): ReactElement {
  return (
    <p role={required && error ? "alert" : "status"}>
      {required
        ? "Registre uma negociação no Financeiro para vinculá-la aqui."
        : "Nenhuma negociação registrada no Financeiro."}
    </p>
  );
}
