import type { ReactElement } from "react";
import { Button, DialogFooter } from "@lazuli/ui";

type FormDialogFooterProps = {
  form: string;
  label: string;
  pendingLabel?: string;
  pending: boolean;
  disabled?: boolean;
  onCancel: () => void;
};

/** A pinned footer submits the form in the scrolling dialog body. */
export function FormDialogFooter({
  form,
  label,
  pending,
  pendingLabel = "Salvando…",
  disabled,
  onCancel,
}: FormDialogFooterProps): ReactElement {
  return (
    <DialogFooter>
      <Button
        type="button"
        size="compact-responsive"
        variant="secondary"
        disabled={pending}
        onClick={onCancel}
      >
        Cancelar
      </Button>
      <Button type="submit" size="compact-responsive" form={form} disabled={pending || disabled}>
        {pending ? pendingLabel : label}
      </Button>
    </DialogFooter>
  );
}
