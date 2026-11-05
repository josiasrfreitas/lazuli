"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { Pencil } from "lucide-react";
import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";
import { materialCardFeeLabel } from "./material-card-fee";
import styles from "./contract-material.module.css";

type Props = Pick<FormProps, "fields" | "change"> & {
  defaultRate: number | undefined;
  error: string | undefined;
};

export function MaterialCardFeeField({ fields, change, defaultRate, error }: Props): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const custom = fields.materialCardFeeMode === "CUSTOM";
  useEffect(() => {
    if (custom || !restoreFocus.current) return;
    restoreFocus.current = false;
    editButton.current?.focus();
  }, [custom]);
  function edit(): void {
    change(
      "materialCardFeePct",
      defaultRate === undefined ? "" : String(defaultRate).replace(".", ","),
    );
    change("materialCardFeeMode", "CUSTOM");
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }
  function restore(): void {
    restoreFocus.current = true;
    change("materialCardFeeMode", "REFERENCE");
  }
  return (
    <Field name="materialCardFeePct">
      <div className={styles.priceRow}>
        <Label>Taxa do cartão</Label>
        {custom ? (
          <div className={styles.feeInput}>
            <Input
              ref={input}
              name="materialCardFeePct"
              size="sm"
              inputMode="decimal"
              placeholder="Ex.: 5"
              autoComplete="off"
              value={fields.materialCardFeePct}
              invalid={Boolean(error)}
              onChange={(event) => change("materialCardFeePct", event.target.value)}
              aria-label="Taxa do cartão (%)"
            />
            <span aria-hidden="true">%</span>
          </div>
        ) : (
          <Button
            ref={editButton}
            type="button"
            variant="ghost"
            size="sm"
            onClick={edit}
            aria-label="Editar taxa do cartão"
          >
            <span className={styles.price}>
              {defaultRate === undefined ? "Definir taxa" : materialCardFeeLabel(defaultRate)}
            </span>
            <Pencil aria-hidden="true" />
          </Button>
        )}
      </div>
      {custom && (
        <div className={styles.adjustment}>
          <span>Só nesta compra.</span>
          {defaultRate !== undefined && (
            <Button type="button" variant="text" size="inline" onClick={restore}>
              Usar padrão ({materialCardFeeLabel(defaultRate)})
            </Button>
          )}
        </div>
      )}
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
