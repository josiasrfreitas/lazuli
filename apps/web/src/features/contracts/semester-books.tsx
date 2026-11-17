"use client";
import { MaterialBookSelection, materialBookOptions } from "./material-book-fields";
import { BookReceiptTerms, initialBookTerms } from "./book-receipt-terms";
import { SelectControl } from "~/features/classes/form-controls";
import { useEffect, useState, type ReactElement } from "react";
import type { ContractMaterialInput } from "@lazuli/validators";
import type { FormProps } from "./contract-form-fields";
import { durationFromDates } from "./contract-form-model";
import type { SetupMaterial } from "./contract-setup-material";

type Book = {
  stageId: string | null;
  acquisitionSemester: number | null;
  acquisition?: ContractMaterialInput;
};
export function contractBooks(value: string | undefined): Book[] {
  return value ? (JSON.parse(value) as Book[]) : [];
}

export function SemesterBooks({
  fields,
  change,
  errors,
  material,
}: Pick<FormProps, "fields" | "change" | "errors"> & { material: SetupMaterial }): ReactElement {
  const count = durationFromDates(fields) / 6;
  const stored = contractBooks(fields.materialBooks);
  const suggestions = fields.materialStageIds.split(",");
  const rows = Array.from(
    { length: count },
    (_, i) => stored[i] ?? { stageId: suggestions[i] || null, acquisitionSemester: null },
  );
  const serialized = JSON.stringify(rows);
  useEffect(() => {
    if (fields.materialBooks !== serialized) change("materialBooks", serialized);
  }, [serialized, change, fields.materialBooks]);
  const update = (index: number, row: Book) =>
    change("materialBooks", JSON.stringify(rows.map((old, i) => (i === index ? row : old))));
  const catalog = material.stages.data ?? [];
  const prices = material.prices.data;
  return (
    <section className="grid gap-4">
      <p>Indique quando cada livro será pago.</p>
      {!prices && !material.prices.isLoading && (
        <p className="text-sm text-muted-foreground">
          Para registrar um pagamento agora, confira os preços em Ajustes financeiros. Você pode
          deixar os livros previstos.
        </p>
      )}
      {rows.map((book, i) => (
        <fieldset key={i} className="grid gap-3 border-t border-border py-3 sm:grid-cols-2">
          <legend className="pr-3 font-semibold">{i + 1}º semestre</legend>
          <SemesterBookSearch
            index={i}
            catalog={catalog}
            selected={rows.map((row) => row.stageId ?? "")}
            pending={material.stages.isLoading}
            failed={material.stages.isError}
            onChange={(stageId) =>
              update(i, { stageId: stageId || null, acquisitionSemester: book.acquisitionSemester })
            }
          />
          <SelectControl
            name={`book-timing-${i}`}
            label="Pagamento"
            value={book.acquisition ? "now" : String(book.acquisitionSemester ?? "open")}
            choices={[
              { value: "open", label: "Data em aberto" },
              ...(book.stageId && prices ? [{ value: "now", label: "Pago no ato" }] : []),
              ...rows.map((_, j) => ({ value: String(j + 1), label: `No ${j + 1}º semestre` })),
            ]}
            onChange={(value) => {
              const stage = catalog.find((s) => s.id === book.stageId);
              if (value === "now" && stage && prices)
                update(i, {
                  ...book,
                  acquisitionSemester: null,
                  acquisition: initialBookTerms(stage, prices),
                });
              else update(i, { stageId: book.stageId, acquisitionSemester: Number(value) || null });
            }}
          />
          {book.acquisition && prices && (
            <BookReceiptTerms
              terms={book.acquisition}
              prices={prices}
              change={(terms) => update(i, { ...book, acquisition: terms })}
            />
          )}
        </fieldset>
      ))}
      {errors.materialBooks && <p role="alert">{errors.materialBooks}</p>}
    </section>
  );
}

export function SemesterBookSearch({
  index,
  catalog,
  selected,
  pending,
  failed,
  onChange,
}: {
  index: number;
  catalog: NonNullable<SetupMaterial["stages"]["data"]>;
  selected: string[];
  pending: boolean;
  failed: boolean;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const books = materialBookOptions(catalog);
  const id = selected[index] ?? "";
  const choose = (id: string) => {
    onChange(id);
    setQuery("");
  };
  return (
    <MaterialBookSelection
      {...{ index, selected, id, books, query, setQuery, pending, failed }}
      value={books.find((b) => b.id === id) ?? null}
      select={choose}
      remove={() => choose("")}
      errors={{}}
    />
  );
}
