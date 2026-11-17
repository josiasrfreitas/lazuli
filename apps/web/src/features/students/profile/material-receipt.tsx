"use client";
import { useRef, useState } from "react";
import { Button, DialogBody, DialogFooter, Field, Input, Label } from "@lazuli/ui";
import { addContractMaterialInputSchema, type ContractMaterialInput } from "@lazuli/validators";
import { BookReceiptTerms, initialBookTerms } from "~/features/contracts/book-receipt-terms";
import { SemesterBookSearch } from "~/features/contracts/semester-books";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { trpc } from "~/lib/trpc";

export type MaterialTarget = {
  contractId: string;
  semester?: number;
  stageId: string | null;
  name?: string | null;
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
}) {
  const today = toDateOnlySaoPaulo(new Date());
  const [date, setDate] = useState(today);
  const [stageId, setStageId] = useState(target.stageId ?? "");
  const [edited, setEdited] = useState<ContractMaterialInput>();
  const command = useRef(crypto.randomUUID());
  const catalog = trpc.finance.contractMaterialOptions.useQuery();
  const prices = trpc.finance.readMaterialPrice.useQuery();
  const mutation = trpc.finance.addContractMaterial.useMutation();
  const stage = catalog.data?.find((s) => s.id === stageId);
  const terms = edited ?? (stage && prices.data ? initialBookTerms(stage, prices.data) : undefined);
  const input = addContractMaterialInputSchema.safeParse({
    commandId: command.current,
    contractId: target.contractId,
    semester: target.semester,
    firstDueDate: date,
    material: terms,
  });
  return (
    <>
      <DialogBody>
        <fieldset disabled={mutation.isPending} className="grid gap-4 py-4 sm:grid-cols-2">
          {target.stageId ? (
            <strong className="self-end">{target.name ?? stage?.name}</strong>
          ) : (
            <SemesterBookSearch
              index={0}
              catalog={catalog.data ?? []}
              selected={[stageId]}
              onChange={(id) => {
                setStageId(id);
                setEdited(undefined);
              }}
              pending={catalog.isPending}
              failed={catalog.isError}
            />
          )}
          <Field name="material-paid-on">
            <Label>Data do pagamento</Label>
            <Input
              name="material-paid-on"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {terms && prices.data && (
            <BookReceiptTerms terms={terms} prices={prices.data} change={setEdited} />
          )}
          {prices.data === null && (
            <p role="status">
              Cadastre os preços dos livros em Ajustes financeiros para registrar o pagamento.
            </p>
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
          {mutation.isError && <p role="alert">{mutation.error.message}</p>}
        </fieldset>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onBack} disabled={mutation.isPending}>
          Voltar
        </Button>
        <Button
          disabled={
            !input.success ||
            !terms ||
            (!terms.receivedMethod && terms.scholarshipPct !== 100) ||
            date > today ||
            mutation.isPending
          }
          onClick={() => {
            if (!input.success) return;
            onPending(true);
            mutation.mutate(input.data, { onSuccess: onSaved, onSettled: () => onPending(false) });
          }}
        >
          {mutation.isPending
            ? "Registrando…"
            : terms?.scholarshipPct === 100
              ? "Confirmar bolsa integral"
              : "Registrar pagamento"}
        </Button>
      </DialogFooter>
    </>
  );
}
