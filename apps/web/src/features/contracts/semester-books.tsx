"use client";
import { CurrencyInput, Field, Label } from "@lazuli/ui";
import { MaterialBookSelection, materialBookOptions } from "./material-book-fields";
import { BookReceiptTerms, initialBookTerms } from "./book-receipt-terms";
import { SelectControl } from "~/features/classes/form-controls";
import { useEffect, useState, type ReactElement } from "react";
import type { ContractMaterialInput } from "@lazuli/validators";
import type { FormProps } from "./contract-form-fields";
import { durationFromDates, MONTHS_PER_SEMESTER } from "./contract-form-model";
import type { SetupMaterial } from "./contract-setup-material";

type Book = {
  stageId: string | null;
  acquisitionSemester: number | null;
  agreedPriceCents?: number | null | undefined;
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
  const count = durationFromDates(fields) / MONTHS_PER_SEMESTER;
  const stored = contractBooks(fields.materialBooks);
  const suggestions = fields.materialStageIds.split(",");
  const catalog = material.stages.data ?? [];
  const prices = material.prices.data;
  const rows: Book[] = Array.from({ length: count }, (_entry, index) => {
    const book = stored[index] ?? {
      stageId: suggestions[index] || null,
      acquisitionSemester: null,
    };
    const stage = catalog.find((stage) => stage.id === book.stageId);
    if (!stage || !prices || book.acquisition || book.agreedPriceCents !== undefined) return book;
    const reference = initialBookTerms(stage, prices).expectedTotalCents;
    return reference > 0 ? { ...book, agreedPriceCents: reference } : book;
  });
  const serialized = JSON.stringify(rows);
  useEffect(() => {
    if (fields.materialBooks !== serialized) change("materialBooks", serialized);
  }, [serialized, change, fields.materialBooks]);
  const update = (index: number, row: Book): void =>
    change(
      "materialBooks",
      JSON.stringify(rows.map((old, rowIndex) => (rowIndex === index ? row : old))),
    );
  return (
    <section className="grid gap-4">
      <p>Indique quando cada livro será pago.</p>
      {!prices && !material.prices.isLoading && (
        <p className="text-sm text-muted-foreground">
          Para registrar um pagamento agora, confira os preços em Ajustes financeiros. Você pode
          deixar os livros previstos.
        </p>
      )}
      {rows.map((book, index) => (
        <SemesterBookRow
          key={index}
          book={book}
          index={index}
          rows={rows}
          catalog={catalog}
          material={material}
          update={(row) => update(index, row)}
        />
      ))}
      {errors.materialBooks && <p role="alert">{errors.materialBooks}</p>}
    </section>
  );
}

function SemesterBookRow({
  book,
  index,
  rows,
  catalog,
  material,
  update,
}: {
  book: Book;
  index: number;
  rows: Book[];
  catalog: NonNullable<SetupMaterial["stages"]["data"]>;
  material: SetupMaterial;
  update: (book: Book) => void;
}): ReactElement {
  const prices = material.prices.data;
  return (
    <fieldset className="grid gap-3 border-t border-border py-3 sm:grid-cols-2">
      <legend className="pr-3 font-semibold">{index + 1}º semestre</legend>
      <SemesterBookSearch
        index={index}
        catalog={catalog}
        selected={rows.map((row) => row.stageId ?? "")}
        pending={material.stages.isLoading}
        failed={material.stages.isError}
        onChange={(stageId) =>
          update({ stageId: stageId || null, acquisitionSemester: book.acquisitionSemester })
        }
      />
      <SelectControl
        name={`book-timing-${index}`}
        label="Pagamento"
        value={book.acquisition ? "now" : String(book.acquisitionSemester ?? "open")}
        choices={[
          { value: "open", label: "Data em aberto" },
          ...(book.stageId && prices ? [{ value: "now", label: "Pago no ato" }] : []),
          ...rows.map((_entry, semesterIndex) => ({
            value: String(semesterIndex + 1),
            label: `No ${semesterIndex + 1}º semestre`,
          })),
        ]}
        onChange={(value) => update(bookForPayment({ book, value, catalog, prices }))}
      />
      {!book.acquisition && book.stageId && (
        <Field name={`book-price-${index}`} className="max-w-48">
          <Label>Valor combinado</Label>
          <CurrencyInput
            name={`book-price-${index}`}
            value={book.agreedPriceCents ?? null}
            onValueChange={(value) => update({ ...book, agreedPriceCents: value })}
          />
        </Field>
      )}
      {book.acquisition && prices && (
        <BookReceiptTerms
          terms={book.acquisition}
          prices={prices}
          change={(terms) => update({ ...book, acquisition: terms })}
        />
      )}
    </fieldset>
  );
}

function bookForPayment({
  book,
  value,
  catalog,
  prices,
}: {
  book: Book;
  value: string;
  catalog: NonNullable<SetupMaterial["stages"]["data"]>;
  prices: SetupMaterial["prices"]["data"];
}): Book {
  const stage = catalog.find((stage) => stage.id === book.stageId);
  if (value === "now" && stage && prices) {
    return {
      stageId: book.stageId,
      acquisitionSemester: null,
      acquisition: {
        ...initialBookTerms(stage, prices),
        priceOverrideCents: book.agreedPriceCents ?? undefined,
      },
    };
  }
  return {
    stageId: book.stageId,
    agreedPriceCents: book.agreedPriceCents ?? book.acquisition?.priceOverrideCents,
    acquisitionSemester: Number(value) || null,
  };
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
}): ReactElement {
  const [query, setQuery] = useState("");
  const books = materialBookOptions(catalog);
  const id = selected[index] ?? "";
  const choose = (id: string): void => {
    onChange(id);
    setQuery("");
  };
  return (
    <MaterialBookSelection
      {...{ index, selected, id, books, query, setQuery, pending, failed }}
      value={books.find((book) => book.id === id) ?? null}
      select={choose}
      remove={() => choose("")}
      errors={{}}
    />
  );
}
