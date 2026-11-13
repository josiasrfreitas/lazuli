"use client";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { z } from "@lazuli/validators";
import {
  ToastAlert,
  Button,
  type ButtonVariant,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  Label,
  Textarea,
} from "@lazuli/ui";
import { useScrollToError } from "~/lib/scroll-to-error";
type Validation = {
  errors: Record<string, string>;
  body: ReturnType<typeof useScrollToError>;
  validate: <T>(schema: z.ZodType<T>, values: object) => T | null;
  clear: (name: string) => void;
  validateFields: (
    schema: z.ZodType<object>,
    input: { values: object; fields: string[] },
  ) => boolean;
};
export function useValidation(): Validation {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  function validate<T>(schema: z.ZodType<T>, values: object): T | null {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      next[String(issue.path[0])] = issue.message;
      next[issue.path.join(".")] = issue.message;
    }
    setErrors(next);
    setRevision((value) => value + 1);
    return null;
  }
  const clear = (name: string): void =>
    setErrors((value) =>
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== name && !key.startsWith(`${name}.`)),
      ),
    );
  function validateFields(
    schema: z.ZodType<object>,
    input: { values: object; fields: string[] },
  ): boolean {
    const parsed = schema.safeParse(input.values);
    const issues = parsed.success
      ? []
      : parsed.error.issues.filter((issue) => input.fields.includes(String(issue.path[0])));
    const next: Record<string, string> = {};
    for (const issue of issues) {
      next[String(issue.path[0])] = issue.message;
      next[issue.path.join(".")] = issue.message;
    }
    setErrors(next);
    if (issues.length > 0) setRevision((value) => value + 1);
    return issues.length === 0;
  }
  return { errors, body, validate, validateFields, clear };
}
const DEFAULT_ROWS = 3;
export function NarrativeField({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  rows = DEFAULT_ROWS,
  labelIcon,
}: {
  rows?: number;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
  labelIcon?: ReactNode;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>
        {labelIcon ? (
          <span className="inline-flex items-center gap-1.5">
            {labelIcon}
            {label}
          </span>
        ) : (
          label
        )}
      </Label>
      <Textarea
        id={name}
        name={name}
        autoComplete="off"
        rows={rows}
        size={rows <= 2 ? "sm" : "md"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        invalid={Boolean(error)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
type TaskDialogProps = {
  title: string;
  description?: string;
  onClose: () => void;
  pending: boolean;
  formId: string;
  firstField: string;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode | ((actions: ReactNode) => ReactNode);
  size?: "compact" | "default" | "medium" | "wide" | "extra-wide";
  onBack?: (() => void) | undefined;
  submitDisabled?: boolean;
  hideCancel?: boolean;
  actionSize?: "sm" | "md";
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  backIcon?: ReactNode;
  layout?: "appointment" | "appointment-calendar" | "occurrence" | "termination";
  bodyLayout?: "calendar" | "termination" | "placement";
  compactHeader?: boolean;
  headerAction?: ReactNode;
  scheduleFrame?: boolean;
  embedded?: boolean;
  returnAction?: { label: string; onClick: () => void } | undefined;
  error?: string | undefined;
  bodyRef?: React.RefObject<HTMLDivElement | null> | undefined;
  submitVariant?: ButtonVariant;
};
export function TaskDialog(props: TaskDialogProps): ReactElement {
  if (props.embedded) return <TaskContent {...props} />;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <TaskContent {...props} />
      </DialogPortal>
    </Dialog>
  );
}
function TaskContent(props: TaskDialogProps): ReactElement {
  const actions = <TaskActions {...props} />;
  useEffect(() => {
    if (!props.embedded) return;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `#${CSS.escape(props.firstField)}, [name="${CSS.escape(props.firstField)}"]`,
        )
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [props.embedded, props.firstField]);
  const body = <TaskBody props={props} actions={actions} />;
  if (props.embedded) return body;
  return (
    <DialogContent
      className="data-[size=compact]:md:max-w-sm data-[size=medium]:md:max-w-3xl data-[size=wide]:md:max-w-5xl data-[size=extra-wide]:md:max-w-6xl data-[layout=appointment]:max-h-[min(calc(110dvh-4.4rem),calc(100dvh-1rem))] data-[layout=appointment-calendar]:h-[85dvh] data-[layout=appointment-calendar]:max-h-[calc(100dvh-2rem)] data-[layout=appointment-calendar]:w-[calc(100vw-2rem)] data-[layout=appointment-calendar]:max-w-[1224px] data-[layout=occurrence]:w-[calc(100vw-48px)] data-[layout=occurrence]:max-w-[1280px] max-[959px]:data-[layout=occurrence]:w-[calc(100vw-24px)] data-[layout=termination]:md:w-[calc(100vw-3rem)] data-[layout=termination]:md:max-w-[1120px] data-[layout=termination]:[&>[data-slot=dialog-footer]]:mt-4 data-[schedule-frame=true]:transition-[opacity,scale,translate,width,max-width] motion-reduce:data-[schedule-frame=true]:transition-[opacity]"
      data-size={props.size ?? "default"}
      data-layout={props.layout}
      data-schedule-frame={props.scheduleFrame || undefined}
      showCloseButton={!props.pending}
      initialFocus={() =>
        document.querySelector<HTMLElement>(
          `#${CSS.escape(props.firstField)}, [name="${CSS.escape(props.firstField)}"]`,
        )
      }
    >
      {body}
    </DialogContent>
  );
}

function TaskBody({
  props,
  actions,
}: {
  props: TaskDialogProps;
  actions: ReactElement;
}): ReactElement {
  return (
    <>
      {props.returnAction && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={props.pending}
            onClick={props.returnAction.onClick}
          >
            <ArrowLeft aria-hidden="true" /> {props.returnAction.label}
          </Button>
        </div>
      )}
      <DialogHeader
        className={
          props.compactHeader
            ? `flex-row flex-wrap gap-x-3 gap-y-1 ${props.headerAction ? "items-center" : "items-baseline"}`
            : undefined
        }
      >
        <DialogTitle>{props.title}</DialogTitle>
        {props.description && <DialogDescription>{props.description}</DialogDescription>}
        {props.headerAction && (
          <div className="-translate-y-2 ml-auto shrink-0">{props.headerAction}</div>
        )}
      </DialogHeader>
      <DialogBody
        ref={props.bodyRef}
        data-body-layout={props.bodyLayout}
        className="data-[body-layout=calendar]:flex data-[body-layout=calendar]:min-h-0 data-[body-layout=calendar]:flex-col data-[body-layout=calendar]:overflow-hidden data-[body-layout=termination]:pt-3 data-[body-layout=placement]:min-h-80"
      >
        {typeof props.children === "function" ? props.children(actions) : props.children}
        {props.error && <ToastAlert variant="destructive">{props.error}</ToastAlert>}
      </DialogBody>
      {typeof props.children !== "function" && <DialogFooter>{actions}</DialogFooter>}
    </>
  );
}
function TaskActions(props: TaskDialogProps): ReactElement {
  const size = props.actionSize ?? "md";
  return (
    <>
      {props.onBack && (
        <Button
          type="button"
          size={size}
          variant="ghost"
          disabled={props.pending}
          onClick={props.onBack}
        >
          {props.backIcon ?? <ArrowLeft aria-hidden="true" />} Voltar
        </Button>
      )}
      {!props.hideCancel && (
        <Button
          type="button"
          size={size}
          variant="secondary"
          disabled={props.pending}
          onClick={props.onClose}
        >
          {props.cancelIcon ?? <X aria-hidden="true" />} Cancelar
        </Button>
      )}
      <Button
        id={`${props.formId}-submit`}
        type="submit"
        form={props.formId}
        size={size}
        disabled={props.pending || props.submitDisabled}
        variant={props.submitVariant ?? "primary"}
      >
        {props.submitIcon ?? <Check aria-hidden="true" />}
        {props.pending ? (props.pendingLabel ?? "Salvando…") : props.submitLabel}
      </Button>
    </>
  );
}
