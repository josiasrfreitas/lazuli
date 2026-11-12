"use client";
import { useState, type FormEvent, type ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { Link2, Search } from "lucide-react";
import { z } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { CATEGORY, dateLabel, QueryState, type OccurrenceRow } from "./shared";
import { QueryLoading } from "~/components/query-loading";
import styles from "./link-form.module.css";

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLocaleLowerCase("pt-BR");
type Target =
  | { type: "occurrence"; id: string }
  | { type: "intervention"; id: string; version: number };
type Props = { studentId: string; target: Target; exclude: string[]; onClose: () => void };
type LinkMutation = {
  pending: boolean;
  error: string | undefined;
  submit: (id: string) => void;
  reset: () => void;
};
type Model = {
  selected: string;
  search: string;
  validation: ReturnType<typeof useValidation>;
  rows: {
    data: RouterOutputs["occurrences"]["forStudent"] | undefined;
    isPending: boolean;
    isError: boolean;
    error: { message: string } | null;
    refetch: () => void;
  };
  mutation: LinkMutation;
  choices: OccurrenceRow[];
  visible: OccurrenceRow[];
  selectedRow: OccurrenceRow | undefined;
  canSubmit: boolean;
  select: (id: string) => void;
  searchChange: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LinkOccurrenceForm(props: Props): ReactElement {
  const model = useLinkOccurrenceModel(props);
  return <LinkOccurrenceDialog {...props} model={model} />;
}

function useLinkOccurrenceModel({ studentId, target, exclude, onClose }: Props): Model {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const validation = useValidation();
  const rows = trpc.occurrences.forStudent.useQuery({ studentId });
  const mutation = useLinkMutation(target, onClose);
  const choices = eligibleChoices({ rows: rows.data ?? [], exclude, target });
  const visible = searchChoices(choices, search);
  const selectedRow = choices.find((row) => row.id === selected);
  const canSubmit = Boolean(selectedRow) && !rows.isPending && !rows.isError;
  function select(id: string): void {
    setSelected(id);
    validation.clear("id");
    mutation.reset();
  }
  function searchChange(value: string): void {
    setSearch(value);
    select("");
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.pending || !canSubmit) return;
    if (
      !validation.validate(z.object({ id: z.string().uuid("Selecione uma ocorrência.") }), {
        id: selected,
      })
    )
      return;
    mutation.submit(selected);
  }
  return {
    selected,
    search,
    validation,
    rows,
    mutation,
    choices,
    visible,
    selectedRow,
    canSubmit,
    select,
    searchChange,
    submit,
  };
}

function useLinkMutation(target: Target, onClose: () => void): LinkMutation {
  const utils = trpc.useUtils();
  const onSuccess = async (): Promise<void> => {
    await Promise.all([utils.occurrences.invalidate(), utils.interventions.invalidate()]);
    onClose();
  };
  const occurrence = trpc.occurrences.link.useMutation({ onSuccess });
  const intervention = trpc.interventions.link.useMutation({ onSuccess });
  function submit(id: string): void {
    if (target.type === "occurrence") occurrence.mutate({ occurrenceId: target.id, relatedId: id });
    else intervention.mutate({ id: target.id, version: target.version, occurrenceId: id });
  }
  function reset(): void {
    occurrence.reset();
    intervention.reset();
  }
  return {
    pending: occurrence.isPending || intervention.isPending,
    error: occurrence.error?.message ?? intervention.error?.message,
    submit,
    reset,
  };
}

function eligibleChoices({
  rows,
  exclude,
  target,
}: {
  rows: OccurrenceRow[];
  exclude: string[];
  target: Target;
}): OccurrenceRow[] {
  return rows.filter(
    (row) => !exclude.includes(row.id) && !(target.type === "occurrence" && row.id === target.id),
  );
}
function searchChoices(choices: OccurrenceRow[], search: string): OccurrenceRow[] {
  const query = normalize(search.trim());
  return choices.filter((row) =>
    normalize(
      [
        row.title,
        row.account,
        CATEGORY[row.category],
        dateLabel(row.classSession?.date ?? row.occurredOn ?? row.createdAt),
        row.classSession?.class.portalClassName ?? "Fora de Aula",
        row.recordedBy.name,
      ].join(" "),
    ).includes(query),
  );
}

function LinkOccurrenceDialog({ target, onClose, model }: Props & { model: Model }): ReactElement {
  return (
    <TaskDialog
      title={
        target.type === "occurrence" ? "Relacionar ocorrências" : "Incluir ocorrência motivadora"
      }
      description="Escolha um relato do aluno. Os registros já relacionados não aparecem nesta lista."
      size="medium"
      formId="link-occurrence"
      firstField="related-occurrence-search"
      submitLabel={target.type === "occurrence" ? "Relacionar ocorrência" : "Incluir ocorrência"}
      submitIcon={<Link2 aria-hidden="true" />}
      submitDisabled={!model.canSubmit}
      actionSize="sm"
      pending={model.mutation.pending}
      onClose={onClose}
      error={model.mutation.error}
      bodyRef={model.validation.body}
    >
      <form id="link-occurrence" noValidate className={styles.form} onSubmit={model.submit}>
        <LinkSearch model={model} />
        <QueryState
          pending={false}
          error={model.rows.error}
          retry={() => void model.rows.refetch()}
        />
        <LinkResults model={model} />
        <FieldError match={Boolean(model.validation.errors.id)}>
          {model.validation.errors.id}
        </FieldError>
        <p className={styles.selection} aria-live="polite">
          {model.selectedRow ? (
            <>
              Selecionado: <strong>{model.selectedRow.title}</strong>
            </>
          ) : (
            "Selecione um relato para continuar."
          )}
        </p>
      </form>
    </TaskDialog>
  );
}

function LinkSearch({ model }: { model: Model }): ReactElement {
  return (
    <Field>
      <Label htmlFor="related-occurrence-search">Buscar relato</Label>
      <div className={styles.search}>
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <Input
          id="related-occurrence-search"
          name="related-occurrence-search"
          autoComplete="off"
          placeholder="Título, trecho do relato, turma ou data"
          value={model.search}
          disabled={model.mutation.pending}
          onChange={(event) => model.searchChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

function LinkResults({ model }: { model: Model }): ReactElement | null {
  if (model.rows.isPending) return <QueryLoading label="Carregando relatos do aluno" />;
  if (model.rows.isError) return null;
  return (
    <fieldset
      className={styles.results}
      disabled={model.mutation.pending}
      aria-describedby="related-occurrence-count"
    >
      <legend className="sr-only">Selecione uma ocorrência</legend>
      <p id="related-occurrence-count" className={styles.count} role="status">
        {model.visible.length}{" "}
        {model.visible.length === 1 ? "relato disponível" : "relatos disponíveis"}
      </p>
      {model.visible.length > 0 ? (
        <ul className={styles.list}>
          {model.visible.map((row) => (
            <LinkResultRow key={row.id} row={row} selected={model.selected} select={model.select} />
          ))}
        </ul>
      ) : (
        <LinkEmpty choices={model.choices} />
      )}
    </fieldset>
  );
}

function LinkResultRow({
  row,
  selected,
  select,
}: {
  row: OccurrenceRow;
  selected: string;
  select: (id: string) => void;
}): ReactElement {
  return (
    <li>
      <label className={styles.row} data-selected={selected === row.id}>
        <input
          type="radio"
          name="related-occurrence"
          value={row.id}
          checked={selected === row.id}
          onChange={() => select(row.id)}
          aria-describedby={`related-occurrence-${row.id}`}
        />
        <span className={styles.content}>
          <span className={styles.metadata}>
            <time
              dateTime={new Date(
                row.classSession?.date ?? row.occurredOn ?? row.createdAt,
              ).toISOString()}
            >
              {dateLabel(row.classSession?.date ?? row.occurredOn ?? row.createdAt)}
            </time>
            <span>{CATEGORY[row.category]}</span>
          </span>
          <strong className={styles.title}>{row.title}</strong>
          <span id={`related-occurrence-${row.id}`} className={styles.account}>
            {row.account}
          </span>
          <span className={styles.metadata}>
            <span>{row.classSession?.class.portalClassName ?? "Fora de Aula"}</span>
            {selected === row.id && <span>Registrado por {row.recordedBy.name}</span>}
          </span>
        </span>
      </label>
    </li>
  );
}

function LinkEmpty({ choices }: { choices: OccurrenceRow[] }): ReactElement {
  const filtered = choices.length > 0;
  return (
    <div className={styles.empty}>
      <strong>
        {filtered
          ? "Nenhum relato corresponde à busca"
          : "Nenhum relato disponível para relacionar"}
      </strong>
      <p>
        {filtered
          ? "Tente outro título, trecho ou data."
          : "Os demais relatos deste aluno já estão relacionados ou ainda não foram registrados."}
      </p>
    </div>
  );
}
