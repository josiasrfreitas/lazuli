"use client";
import type { JSX as ReactJSX } from "react";
import { useEffect, useRef, useState } from "react";
import { addCalendarMonths } from "@lazuli/domain";
import { addContractMaterialInputSchema } from "@lazuli/validators";
import { Button, DialogBody, DialogFooter, Field, Input, Label } from "@lazuli/ui";
import { ArrowLeft } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { ContractMaterialSection } from "./contract-material-section";
import { emptyContractFields, type ContractFields } from "./contract-form-model";

function dueDateInMonth(anchor: string, month: string): string {
  const offset =
    (Number(month.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 +
    Number(month.slice(5, 7)) -
    Number(anchor.slice(5, 7));
  return /^\d{4}-\d{2}$/u.test(month) && offset >= 0 ? addCalendarMonths(anchor, offset) : "";
}

export function AddContractMaterial({
  contractId,
  firstDueDate,
  onPendingChange,
  onClose,
  onSaved,
}: {
  contractId: string;
  firstDueDate: string;
  onPendingChange: (pending: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}): ReactJSX.Element {
  const today = toDateOnlySaoPaulo(new Date());
  const [month, setMonth] = useState((today > firstDueDate ? today : firstDueDate).slice(0, 7));
  const [fields, setFields] = useState<ContractFields>({
    ...emptyContractFields,
    materialPayment: "INSTALLMENTS",
  });
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof ContractFields, string>>>({});
  const commandId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const mutation = trpc.finance.addContractMaterial.useMutation();
  const utils = trpc.useUtils();
  const dueDate = dueDateInMonth(firstDueDate, month);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.querySelector<HTMLElement>("[role=combobox]")?.focus();
  }, []);
  return (
    <>
      <DialogBody ref={body}>
        <form
          id="contract-material-form"
          className="grid gap-6 py-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting.current) return;
            const parsed = addContractMaterialInputSchema.safeParse({
              commandId: commandId.current,
              contractId,
              firstDueDate: dueDate,
              material: {
                stageIds: fields.materialStageIds.split(","),
                quoteVersion: fields.materialQuoteVersion,
                category: fields.materialCategory,
                payment: fields.materialPayment,
                expectedTotalCents:
                  fields.materialTotal === "" ? Number.NaN : Number(fields.materialTotal),
              },
            });
            if (!parsed.success) {
              const invalidStages =
                fields.materialStageIds.split(",").some((id) => !id) ||
                new Set(fields.materialStageIds.split(",")).size !==
                  fields.materialStageIds.split(",").length;
              setErrors({
                ...(invalidStages
                  ? { materialStageIds: "Selecione um estágio diferente para cada livro." }
                  : {}),
                ...(fields.materialCategory ? {} : { materialCategory: "Selecione a faixa." }),
                ...(fields.materialTotal ? {} : { materialTotal: "Aguarde o preço do livro." }),
              });
              setError(
                dueDate
                  ? "Confira os campos indicados."
                  : "Escolha um mês a partir do primeiro vencimento do contrato.",
              );
              return;
            }
            setError("");
            submitting.current = true;
            onPendingChange(true);
            mutation.mutate(parsed.data, {
              onSuccess: () => {
                onPendingChange(false);
                onSaved();
                onClose();
              },
              onError: (cause) => {
                setError(cause.message);
                void utils.finance.readMaterialPrice.invalidate();
              },
              onSettled: () => {
                submitting.current = false;
                onPendingChange(false);
              },
            });
          }}
        >
          <fieldset disabled={mutation.isPending} className="grid items-start gap-8 md:grid-cols-2">
            <div className="min-w-0">
              <ContractMaterialSection
                required
                fields={{ ...fields, firstDueDate: dueDate ? formatDateOnlyBR(dueDate) : "" }}
                errors={errors}
                change={(key, value) => {
                  setFields((current) => ({ ...current, [key]: value }));
                  setErrors((current) => ({ ...current, [key]: undefined }));
                }}
              />
            </div>
            <section
              className="grid min-w-0 gap-3 border-t border-border pt-4"
              aria-label="Recebimento do material"
            >
              <h3 className="text-base font-semibold text-heading">Recebimento</h3>
              <p className="text-sm text-muted-foreground">
                Uma cobrança para a escola. As parcelas no cartão são condições acordadas com o
                aluno.
              </p>
              <Field name="materialMonth" className="max-w-64">
                <Label>Mês previsto para o recebimento</Label>
                <Input
                  name="materialMonth"
                  type="month"
                  value={month}
                  min={firstDueDate.slice(0, 7)}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </Field>
              {dueDate && (
                <p className="text-caption text-muted-foreground">
                  Recebimento previsto em {formatDateOnlyBR(dueDate)}, seguindo o dia do contrato.
                </p>
              )}
            </section>
          </fieldset>
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </form>
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          <ArrowLeft aria-hidden="true" /> Voltar aos itens
        </Button>
        <Button type="submit" form="contract-material-form" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando…" : "Adicionar material"}
        </Button>
      </DialogFooter>
    </>
  );
}
