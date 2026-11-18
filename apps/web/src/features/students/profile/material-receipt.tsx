"use client";

import { useRef, useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, CurrencyInput, DialogBody, DialogFooter, Field, Input, Label } from "@lazuli/ui";
import { addContractMaterialInputSchema, type ContractMaterialInput } from "@lazuli/validators";
import { BookReceiptTerms, initialBookTerms } from "~/features/contracts/book-receipt-terms";
import { SemesterBookSearch } from "~/features/contracts/semester-books";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { trpc } from "~/lib/trpc";

const FULL_SCHOLARSHIP_PERCENT = 100;

export type MaterialTarget = {
  contractId: string;
  semester?: number;
  stageId: string | null;
  name?: string | null;
  agreedPriceCents?: number | null;
};

type Catalog = RouterOutputs["finance"]["contractMaterialOptions"];
type Prices = NonNullable<RouterOutputs["finance"]["readMaterialPrice"]>;
type MaterialQuery<Data> = {
  data: Data | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};
type MaterialQueries = {
  catalog: MaterialQuery<Catalog>;
  prices: MaterialQuery<Prices | null>;
};

type ReceiptDraft = {
  today: string;
  date: string;
  setDate: (date: string) => void;
  stageId: string;
  stageName: string | undefined;
  selectStage: (id: string) => void;
  manualPrice: number | null;
  changeManualPrice: (value: number | null) => void;
  terms: ContractMaterialInput | undefined;
  setTerms: (terms: ContractMaterialInput) => void;
  priceList: Prices | null;
};

export function MaterialReceipt({
  target,
  onPending,
  onBack,
  onSaved,
}: {
  target: MaterialTarget;
  onPending: (value: boolean) => void;
  onBack: () => void;
  onSaved: () => void;
}): ReactElement {
  const catalog = trpc.finance.contractMaterialOptions.useQuery();
  const prices = trpc.finance.readMaterialPrice.useQuery();
  const mutation = trpc.finance.addContractMaterial.useMutation();
  const command = useRef(crypto.randomUUID());
  const draft = useReceiptDraft({ target, catalog: catalog.data, configured: prices.data });
  const input = addContractMaterialInputSchema.safeParse({
    commandId: command.current,
    contractId: target.contractId,
    semester: target.semester,
    firstDueDate: draft.date,
    material: draft.terms,
  });

  return (
    <>
      <ReceiptFields
        target={target}
        draft={draft}
        queries={{ catalog, prices }}
        pending={mutation.isPending}
        error={mutation.isError ? mutation.error.message : undefined}
      />
      <DialogFooter>
        <Button variant="secondary" onClick={onBack} disabled={mutation.isPending}>
          Voltar
        </Button>
        <Button
          disabled={mutation.isPending || !input.success || !canRegisterReceipt(draft)}
          onClick={() => {
            if (!input.success) return;
            onPending(true);
            mutation.mutate(input.data, { onSuccess: onSaved, onSettled: () => onPending(false) });
          }}
        >
          {receiptActionLabel(mutation.isPending, draft.terms)}
        </Button>
      </DialogFooter>
    </>
  );
}

function useReceiptDraft({
  target,
  catalog,
  configured,
}: {
  target: MaterialTarget;
  catalog: Catalog | undefined;
  configured: Prices | null | undefined;
}): ReceiptDraft {
  const today = toDateOnlySaoPaulo(new Date());
  const [date, setDate] = useState(today);
  const [stageId, setStageId] = useState(target.stageId ?? "");
  const [edited, setEdited] = useState<ContractMaterialInput>();
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const stage = catalog?.find((item) => item.id === stageId);
  const base = target.agreedPriceCents ?? manualPrice ?? 0;
  const priceList = configured ?? agreedPriceList(configured, base);
  const terms =
    edited ??
    initialReceiptTerms({
      stage,
      priceList,
      override: target.agreedPriceCents ?? (configured === null ? base : undefined),
    });
  return {
    today,
    date,
    setDate,
    stageId,
    stageName: stage?.name,
    selectStage: (id) => {
      setStageId(id);
      setEdited(undefined);
    },
    manualPrice,
    changeManualPrice: (value) => {
      setManualPrice(value);
      setEdited(undefined);
    },
    terms,
    setTerms: setEdited,
    priceList,
  };
}

function agreedPriceList(configured: Prices | null | undefined, cashCents: number): Prices | null {
  if (configured !== null || cashCents <= 0) return null;
  const agreed = { cashCents, version: "AGREED_PRICE" };
  return { adult: agreed, child: agreed, cardFeeRates: {} };
}

function initialReceiptTerms({
  stage,
  priceList,
  override,
}: {
  stage: Catalog[number] | undefined;
  priceList: Prices | null;
  override: number | undefined;
}): ContractMaterialInput | undefined {
  if (!stage || !priceList) return undefined;
  return { ...initialBookTerms(stage, priceList), priceOverrideCents: override };
}

function canRegisterReceipt({ terms, date, today }: ReceiptDraft): boolean {
  if (!terms || date > today) return false;
  if (
    terms.quoteVersion === "AGREED_PRICE" &&
    terms.payment === "INSTALLMENTS" &&
    terms.cardFeeOverridePct === undefined
  )
    return false;
  return Boolean(terms.receivedMethod) || terms.scholarshipPct === FULL_SCHOLARSHIP_PERCENT;
}

function receiptActionLabel(pending: boolean, terms: ContractMaterialInput | undefined): string {
  if (pending) return "Registrando…";
  return terms?.scholarshipPct === FULL_SCHOLARSHIP_PERCENT
    ? "Confirmar bolsa integral"
    : "Registrar pagamento";
}

function ReceiptFields({
  target,
  draft,
  queries,
  pending,
  error,
}: {
  target: MaterialTarget;
  draft: ReceiptDraft;
  queries: MaterialQueries;
  pending: boolean;
  error: string | undefined;
}): ReactElement {
  const { catalog, prices } = queries;
  return (
    <DialogBody>
      <fieldset disabled={pending} className="grid gap-4 py-4 sm:grid-cols-2">
        <ReceiptBook target={target} draft={draft} catalog={catalog} />
        <Field name="material-paid-on">
          <Label>Data do pagamento</Label>
          <Input
            name="material-paid-on"
            autoFocus={Boolean(target.stageId)}
            type="date"
            max={draft.today}
            value={draft.date}
            onChange={(event) => draft.setDate(event.target.value)}
          />
        </Field>
        {prices.data === null && !target.agreedPriceCents && (
          <Field name="material-price">
            <Label>Valor combinado (R$)</Label>
            <CurrencyInput
              name="material-price"
              value={draft.manualPrice}
              onValueChange={draft.changeManualPrice}
            />
          </Field>
        )}
        {draft.terms && draft.priceList && (
          <BookReceiptTerms
            terms={draft.terms}
            prices={draft.priceList}
            change={draft.setTerms}
            allowAgreement={false}
          />
        )}
        {(prices.isError || catalog.isError) && (
          <Button
            variant="secondary"
            onClick={() => {
              void prices.refetch();
              void catalog.refetch();
            }}
          >
            Tentar carregar o material
          </Button>
        )}
        {error !== undefined && <p role="alert">{error}</p>}
      </fieldset>
    </DialogBody>
  );
}

function ReceiptBook({
  target,
  draft,
  catalog,
}: {
  target: MaterialTarget;
  draft: ReceiptDraft;
  catalog: MaterialQueries["catalog"];
}): ReactElement {
  if (target.stageId) return <strong className="self-end">{target.name ?? draft.stageName}</strong>;
  return (
    <SemesterBookSearch
      index={0}
      catalog={catalog.data ?? []}
      selected={[draft.stageId]}
      onChange={draft.selectStage}
      pending={catalog.isPending}
      failed={catalog.isError}
    />
  );
}
