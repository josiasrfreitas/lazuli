"use client";
import { CurrencyInput, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
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
      acquisitionSemester: index === 0 ? 1 : null,
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
      <p>Registre os livros pagos no ato. Os demais podem ser pagos depois pelo perfil do aluno.</p>
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
          update({
            stageId: stageId || null,
            acquisitionSemester: index === 0 ? 1 : book.acquisitionSemester,
          })
        }
      />
      <div className="grid content-start justify-items-start gap-1">
        <span>Pagamento do livro</span>
        <SegmentedControl
          size="sm"
          aria-label={`Pagamento do livro do ${index + 1}º semestre`}
          value={book.acquisition ? "now" : "later"}
          onValueChange={(mode) => {
            if (!mode) return;
            const value = mode === "now" ? "now" : index === 0 ? "1" : "open";
            update(bookForPayment({ book, value, catalog, prices }));
          }}
        >
          <SegmentedControlItem value="later">Registrar depois</SegmentedControlItem>
          <SegmentedControlItem value="now" disabled={!book.stageId || !prices}>
            Registrar agora
          </SegmentedControlItem>
        </SegmentedControl>
        {!book.stageId && <small>Selecione o livro para registrar o pagamento agora.</small>}
      </div>
      {!book.acquisition &&
        (index === 0 ? (
          <p className="self-center text-sm">Pagamento previsto no 1º semestre</p>
        ) : (
          <SelectControl
            name={`book-timing-${index}`}
            label="Previsão de pagamento"
            value={String(book.acquisitionSemester ?? "open")}
            choices={[
              { value: "open", label: "Data em aberto" },
              ...rows.map((_entry, semesterIndex) => ({
                value: String(semesterIndex + 1),
                label: `No ${semesterIndex + 1}º semestre`,
              })),
            ]}
            onChange={(value) => update(bookForPayment({ book, value, catalog, prices }))}
          />
        ))}
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
