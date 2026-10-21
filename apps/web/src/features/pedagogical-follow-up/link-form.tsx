"use client";
import { useState, type ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { Link2, Search } from "lucide-react";
import { z } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { CATEGORY, dateLabel, QueryState } from "./shared";
import { QueryLoading } from "~/components/query-loading";
import styles from "./link-form.module.css";

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export function LinkOccurrenceForm({
  studentId,
  target,
  exclude,
  onClose,
}: {
  studentId: string;
  target:
    | { type: "occurrence"; id: string }
    | { type: "intervention"; id: string; version: number };
  exclude: string[];
  onClose: () => void;
}): ReactElement {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const validation = useValidation();
  const rows = trpc.occurrences.forStudent.useQuery({ studentId });
  const utils = trpc.useUtils();
  const onSuccess = async (): Promise<void> => {
    await Promise.all([utils.occurrences.invalidate(), utils.interventions.invalidate()]);
    onClose();
  };
  const occurrence = trpc.occurrences.link.useMutation({ onSuccess });
  const intervention = trpc.interventions.link.useMutation({ onSuccess });
  const pending = occurrence.isPending || intervention.isPending;
  const choices = (rows.data ?? []).filter(
    (row) => !exclude.includes(row.id) && !(target.type === "occurrence" && row.id === target.id),
  );
  const query = normalize(search.trim());
  const visible = choices.filter((row) =>
    normalize(
      [
        row.title,
        row.account,
        CATEGORY[row.category],
        dateLabel(row.classSession.date),
        row.classSession.class.portalClassName,
        row.recordedBy.name,
      ].join(" "),
    ).includes(query),
  );
  const selectedRow = choices.find((row) => row.id === selected);
  const canSubmit = Boolean(selectedRow) && !rows.isPending && !rows.isError;
  function select(id: string): void {
    setSelected(id);
    validation.clear("id");
    occurrence.reset();
    intervention.reset();
  }
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
      submitDisabled={!canSubmit}
      actionSize="sm"
      pending={pending}
      onClose={onClose}
      error={occurrence.error?.message ?? intervention.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="link-occurrence"
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || !canSubmit) return;
          if (
            !validation.validate(z.object({ id: z.string().uuid("Selecione uma ocorrência.") }), {
              id: selected,
            })
          )
            return;
          if (target.type === "occurrence")
            occurrence.mutate({ occurrenceId: target.id, relatedId: selected });
          else
            intervention.mutate({ id: target.id, version: target.version, occurrenceId: selected });
        }}
      >
        <Field>
          <Label htmlFor="related-occurrence-search">Buscar relato</Label>
          <div className={styles.search}>
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            <Input
              id="related-occurrence-search"
              name="related-occurrence-search"
              autoComplete="off"
              placeholder="Título, trecho do relato, turma ou data"
              value={search}
              disabled={pending}
              onChange={(event) => {
                setSearch(event.target.value);
                select("");
              }}
            />
          </div>
        </Field>
        <QueryState pending={false} error={rows.error} retry={() => void rows.refetch()} />
        {rows.isPending ? (
          <QueryLoading label="Carregando relatos do aluno" />
        ) : (
          !rows.isError && (
            <fieldset
              className={styles.results}
              disabled={pending}
              aria-describedby="related-occurrence-count"
            >
              <legend className="sr-only">Selecione uma ocorrência</legend>
              <p id="related-occurrence-count" className={styles.count} role="status">
                {visible.length}{" "}
                {visible.length === 1 ? "relato disponível" : "relatos disponíveis"}
              </p>
              {visible.length > 0 ? (
                <ul className={styles.list}>
                  {visible.map((row) => (
                    <li key={row.id}>
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
                            <time dateTime={new Date(row.classSession.date).toISOString()}>
                              {dateLabel(row.classSession.date)}
                            </time>
                            <span>{CATEGORY[row.category]}</span>
                          </span>
                          <strong className={styles.title}>{row.title}</strong>
                          <span id={`related-occurrence-${row.id}`} className={styles.account}>
                            {row.account}
                          </span>
                          <span className={styles.metadata}>
                            <span>{row.classSession.class.portalClassName}</span>
                            {selected === row.id && (
                              <span>Registrado por {row.recordedBy.name}</span>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.empty}>
                  <strong>
                    {choices.length > 0
                      ? "Nenhum relato corresponde à busca"
                      : "Nenhum relato disponível para relacionar"}
                  </strong>
                  <p>
                    {choices.length > 0
                      ? "Tente outro título, trecho ou data."
                      : "Os demais relatos deste aluno já estão relacionados ou ainda não foram registrados."}
                  </p>
                </div>
              )}
            </fieldset>
          )
        )}
        <FieldError match={Boolean(validation.errors.id)}>{validation.errors.id}</FieldError>
        <p className={styles.selection} aria-live="polite">
          {selectedRow ? (
            <>
              Selecionado: <strong>{selectedRow.title}</strong>
            </>
          ) : (
            "Selecione um relato para continuar."
          )}
        </p>
      </form>
    </TaskDialog>
  );
}
