"use client";

import { useState, type ReactElement } from "react";
import { normalizeSearch } from "@lazuli/domain";
import type { RouterOutputs } from "@lazuli/api";
import { Button, Field, FieldError, Label, SearchSelect } from "@lazuli/ui";
import { Plus, X } from "lucide-react";
import type { FormProps } from "./contract-form-fields";
import styles from "./contract-setup.module.css";

type Props = Pick<FormProps, "fields" | "change" | "errors"> & {
  options: RouterOutputs["finance"]["contractMaterialOptions"] | undefined;
  pending: boolean;
  failed: boolean;
  retry: () => void;
};

export function MaterialStages(props: Props): ReactElement {
  const selected = props.fields.materialStageIds.split(",");
  return (
    <div className="grid min-w-0 gap-2">
      <div className={styles.materialBooks}>
        {selected.map((id, index) => (
          <MaterialBook key={index} {...props} selected={selected} id={id} index={index} />
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="flex-none"
          onClick={() => props.change("materialStageIds", `${props.fields.materialStageIds},`)}
        >
          <Plus aria-hidden="true" /> Adicionar livro
        </Button>
      </div>
      {props.errors.materialStageIds && (
        <p role="alert" className="text-caption text-destructive">
          {props.errors.materialStageIds}
        </p>
      )}
      {props.failed && (
        <p role="alert" className="text-caption">
          Não foi possível carregar os livros.{" "}
          <Button type="button" variant="link" onClick={props.retry}>
            Tentar novamente
          </Button>
        </p>
      )}
    </div>
  );
}

type MaterialBookProps = Props & { selected: string[]; id: string; index: number };

function MaterialBook({
  fields,
  errors,
  change,
  options,
  pending,
  failed,
  selected,
  id,
  index,
}: MaterialBookProps): ReactElement {
  const [query, setQuery] = useState("");
  const books = materialBookOptions(options);
  const value = books.find((book) => book.id === id) ?? null;
  const remove = (): void =>
    change("materialStageIds", selected.filter((_value, position) => position !== index).join(","));
  const select = (stageId: string): void => {
    change(
      "materialStageIds",
      selected.map((current, position) => (position === index ? stageId : current)).join(","),
    );
    setQuery("");
    if (!fields.materialCategory) {
      const stage = options?.find((item) => item.id === stageId);
      if (stage) change("materialCategory", stage.track.ageGroup === "CHILD" ? "CHILD" : "ADULT");
    }
  };
  return (
    <div className={styles.materialBook} data-selected={Boolean(value)}>
      <MaterialBookSelection
        {...{
          selected,
          id,
          index,
          books,
          value,
          query,
          setQuery,
          select,
          remove,
          pending,
          failed,
          errors,
        }}
      />
      <RemoveMaterialBook visible={selected.length > 1 && !value} index={index} remove={remove} />
    </div>
  );
}

function materialBookOptions(options: Props["options"]): BookSelectionProps["books"] {
  return (options ?? []).map((stage) => ({
    id: stage.id,
    label: `${stage.name} · ${stage.internalCode}`,
    description: stage.track.name,
  }));
}

function RemoveMaterialBook({
  visible,
  index,
  remove,
}: {
  visible: boolean;
  index: number;
  remove: () => void;
}): ReactElement | null {
  if (!visible) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Remover livro ${index + 1}`}
      onClick={remove}
    >
      <X aria-hidden="true" />
    </Button>
  );
}

type BookSelectionProps = {
  selected: string[];
  id: string;
  index: number;
  books: Array<{ id: string; label: string; description: string }>;
  value: { id: string; label: string; description: string } | null;
  query: string;
  setQuery: (value: string) => void;
  select: (id: string) => void;
  remove: () => void;
  pending: boolean;
  failed: boolean;
  errors: Props["errors"];
};

function MaterialBookSelection({
  selected,
  id,
  index,
  books,
  value,
  query,
  setQuery,
  select,
  remove,
  pending,
  failed,
  errors,
}: BookSelectionProps): ReactElement {
  return (
    <Field name={`material-stage-${index}`} className="min-w-0 flex-1">
      <Label>Livro {index + 1}</Label>
      <SearchSelect
        name={`material-stage-${index}`}
        placeholder="Buscar livro ou estágio…"
        showSearchIcon
        value={value}
        query={query}
        onQueryChange={setQuery}
        options={books.filter(
          (book) =>
            (book.id === id || !selected.includes(book.id)) &&
            normalizeSearch(`${book.label} ${book.description}`).includes(normalizeSearch(query)),
        )}
        onSelect={(book) => select(book.id)}
        onClear={() => (selected.length > 1 ? remove() : select(""))}
        loading={pending}
        failed={failed}
        invalid={Boolean(errors.materialStageIds) && !id}
        emptyMessage="Nenhum livro encontrado."
      />
      {id && !pending && !failed && !value && (
        <FieldError match>Este livro não está mais disponível. Escolha outro.</FieldError>
      )}
    </Field>
  );
}
