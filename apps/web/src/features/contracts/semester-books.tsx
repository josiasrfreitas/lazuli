"use client";
import { MaterialBookSelection, materialBookOptions } from "./material-book-fields";
import { BookAgreement, bookQuote } from "./book-agreement";
import { useEffect, useState, type ReactElement } from "react";
import { materialFinalPriceQuote } from "@lazuli/domain";
import type { ContractMaterialInput } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
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
  const [quoteError, setQuoteError] = useState("");
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
  const control = "h-9 max-w-full rounded-sm border border-border bg-background px-2";
  function acquisition(
    stageId: string | null,
    method: ContractMaterialInput["payment"],
    installments: number,
  ): ContractMaterialInput | undefined {
    const stage = catalog.find((s) => s.id === stageId);
    if (!stage || !prices) return undefined;
    const child = stage.track.ageGroup === "CHILD";
    const price = child ? prices.child : prices.adult;
    const fee = method === "CASH" ? 0 : prices.cardFeeRates[String(installments)];
    if (fee === undefined) return undefined;
    const quote = materialFinalPriceQuote({ cashCents: price.cashCents, cardFeePct: fee });
    return {
      stageIds: [stage.id],
      payment: method,
      category: child ? "CHILD" : "ADULT",
      installmentCount: installments,
      expectedTotalCents: method === "CASH" ? quote.cashCents : quote.totalCents,
      quoteVersion: price.version,
    };
  }
  return (
    <section className="grid gap-4">
      <p>
        Um livro por semestre. Registrar a aquisição gera a cobrança. O pagamento é lançado no
        financeiro.
      </p>
      {!prices && !material.prices.isLoading && (
        <p className="text-sm text-muted-foreground">
          Para registrar uma aquisição agora, confira os preços em Ajustes financeiros. Você pode
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
          <label className="grid gap-1">
            Aquisição
            <select
              className={control}
              value={book.acquisition ? "now" : (book.acquisitionSemester ?? "")}
              onChange={(e) => {
                if (e.target.value === "now") {
                  const terms = acquisition(book.stageId, "CASH", 1);
                  if (terms) update(i, { ...book, acquisitionSemester: null, acquisition: terms });
                } else
                  update(i, {
                    stageId: book.stageId,
                    acquisitionSemester: Number(e.target.value) || null,
                  });
              }}
            >
              <option value="">Data em aberto</option>
              <option value="now" disabled={!book.stageId || !prices}>
                Registrar agora
              </option>
              {rows.map((_, j) => (
                <option key={j} value={j + 1}>
                  Prever para o {j + 1}º semestre
                </option>
              ))}
            </select>
          </label>
          {book.acquisition && (
            <label className="grid gap-1">
              Condição combinada
              <select
                className={control}
                value={
                  book.acquisition.payment === "CASH" ? "cash" : book.acquisition.installmentCount
                }
                onChange={(e) => {
                  const cash = e.target.value === "cash";
                  const terms = acquisition(
                    book.stageId,
                    cash ? "CASH" : "INSTALLMENTS",
                    cash ? 1 : Number(e.target.value),
                  );
                  if (terms) update(i, { ...book, acquisition: terms });
                }}
              >
                <option value="cash">À vista</option>
                {Object.keys(prices?.cardFeeRates ?? {})
                  .sort((a, b) => Number(a) - Number(b))
                  .map((n) => (
                    <option key={n} value={n}>
                      Cartão · {n}x
                    </option>
                  ))}
              </select>
              <span>{prices && money(bookQuote(book.acquisition, prices).charged)}</span>
            </label>
          )}
          {book.acquisition && prices && (
            <BookAgreement
              terms={book.acquisition}
              change={(terms) => {
                try {
                  const quote = bookQuote(terms, prices);
                  update(i, {
                    ...book,
                    acquisition: { ...terms, expectedTotalCents: quote.reference },
                  });
                  setQuoteError("");
                } catch {
                  setQuoteError(
                    "Confira o preço, a taxa e a bolsa. A última condição válida foi mantida.",
                  );
                }
              }}
            />
          )}
        </fieldset>
      ))}
      {quoteError && <p role="alert">{quoteError}</p>}
      {errors.materialBooks && <p role="alert">{errors.materialBooks}</p>}
    </section>
  );
}

function SemesterBookSearch({
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
