"use client";
import { type ClientError, trpc } from "~/lib/trpc";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import {
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type ReactElement,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Alert,
  Button,
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
  FormSection,
  Input,
  Label,
  InlineSkeleton,
} from "@lazuli/ui";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { dateLabel } from "./format";
import { DepartureImpact } from "./departure-impact";

export function DepartureDialog({ teacher, onClose }: DepartureDialogInput): ReactElement {
  return <DepartureContent {...useDepartureForm({ teacher, onClose })} />;
}

type DepartureFooterProps = {
  saveIsPending: boolean;
  onClose: () => void;
  previewDate: string | null;
  previewIsFetching: boolean;
  previewIsError: boolean;
  previewData: RouterOutputs["teachers"]["previewDeparture"] | undefined;
};
function DepartureFooter(props: DepartureFooterProps): ReactElement {
  return (
    <DialogFooter>
      <Button
        size="compact-responsive"
        variant="secondary"
        disabled={props.saveIsPending}
        onClick={props.onClose}
      >
        Cancelar
      </Button>
      <Button
        size="compact-responsive"
        type="submit"
        form="departure-form"
        disabled={
          props.saveIsPending ||
          (props.previewDate !== null && (props.previewIsFetching || props.previewIsError))
        }
      >
        {departureSaveLabel(props)}
      </Button>
    </DialogFooter>
  );
}

type DepartureDateFieldProps = {
  first: RefObject<HTMLInputElement | null>;
  date: string;
  error: string | null;
  saveIsPending: boolean;
  setDate: Dispatch<SetStateAction<string>>;
  setPreviewDate: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};
function DepartureDateField(props: DepartureDateFieldProps): ReactElement {
  return (
    <FormSection
      title="Data da saída"
      description="O acesso ao sistema será bloqueado a partir desta data."
    >
      <div className="w-40">
        <Field>
          <Label htmlFor="departure-date">Vigência</Label>
          <Input
            ref={props.first}
            id="departure-date"
            name="effectiveDate"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            size="compact-responsive"
            value={props.date}
            invalid={Boolean(props.error)}
            disabled={props.saveIsPending}
            onChange={(event) => {
              props.setDate(maskDateBR(event.target.value));
              props.setPreviewDate(null);
              props.setError(null);
            }}
          />
          {props.error && <FieldError match>{props.error}</FieldError>}
        </Field>
      </div>
    </FormSection>
  );
}

type DepartureContentProps = {
  saveIsPending: boolean;
  onClose: () => void;
  first: RefObject<HTMLInputElement | null>;
  teacher: { id: string; name: string; today: string };
  submit: (event: FormEvent<HTMLFormElement>) => void;
  date: string;
  error: string | null;
  setDate: Dispatch<SetStateAction<string>>;
  setPreviewDate: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  previewDate: string | null;
  previewIsFetching: boolean;
  previewIsError: boolean;
  previewError: ClientError | null;
  previewRefetch: () => void;
  previewData: RouterOutputs["teachers"]["previewDeparture"] | undefined;
};
function DepartureContent(props: DepartureContentProps): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.saveIsPending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={props.first}>
          <DialogHeader>
            <DialogTitle>Encerrar atuação</DialogTitle>
            <DialogDescription>
              {props.teacher.name} continuará no cadastro e no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="my-5">
            <DeparturePreviewForm {...props} />
          </DialogBody>
          <DepartureFooter
            saveIsPending={props.saveIsPending}
            onClose={props.onClose}
            previewDate={props.previewDate}
            previewIsFetching={props.previewIsFetching}
            previewIsError={props.previewIsError}
            previewData={props.previewData}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type DeparturePreviewFormProps = DepartureContentProps;
function DeparturePreviewForm(props: DeparturePreviewFormProps): ReactElement {
  return (
    <form id="departure-form" noValidate onSubmit={props.submit} className="grid gap-4">
      <DepartureDateField
        first={props.first}
        date={props.date}
        error={props.error}
        saveIsPending={props.saveIsPending}
        setDate={props.setDate}
        setPreviewDate={props.setPreviewDate}
        setError={props.setError}
      />
      {props.previewDate && props.previewIsFetching && (
        <p role="status" className="text-caption">
          Calculando impactos <InlineSkeleton />
        </p>
      )}
      {props.previewDate && props.previewIsError && (
        <Alert variant="destructive">
          <p>{props.previewError?.message}</p>
          <Button
            type="button"
            variant="secondary"
            size="compact-responsive"
            onClick={() => void props.previewRefetch()}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {props.previewDate && props.previewData && !props.previewIsFetching && (
        <DepartureImpact impact={props.previewData} date={props.previewDate} />
      )}
    </form>
  );
}

type SubmitDepartureContext = {
  save: { isPending: boolean; mutate: (values: RouterInputs["teachers"]["depart"]) => void };
  date: string;
  teacher: { id: string; name: string; today: string };
  setError: Dispatch<SetStateAction<string | null>>;
  first: RefObject<HTMLInputElement | null>;
  previewDate: string | null;
  setPreviewDate: Dispatch<SetStateAction<string | null>>;
  preview: { data: RouterOutputs["teachers"]["previewDeparture"] | undefined; isFetching: boolean };
};
function submitDeparture(
  event: FormEvent<HTMLFormElement>,
  {
    save,
    date,
    teacher,
    setError,
    first,
    previewDate,
    setPreviewDate,
    preview,
  }: SubmitDepartureContext,
): void {
  event.preventDefault();
  if (save.isPending) return;
  const parsed = parseDateBR(date);
  if (!parsed || parsed < teacher.today) {
    setError("Informe hoje ou uma data futura.");
    first.current?.focus();
    return;
  }
  if (!previewDate) {
    setError(null);
    setPreviewDate(parsed);
    return;
  }
  if (preview.data && !preview.isFetching)
    save.mutate({ id: teacher.id, effectiveDate: previewDate, token: preview.data.token });
}

type DepartureDialogInput = {
  teacher: { id: string; name: string; today: string };
  onClose: () => void;
};

function useDepartureForm({ teacher, onClose }: DepartureDialogInput): DepartureContentProps {
  const [date, setDate] = useState(dateLabel(teacher.today));
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const preview = trpc.teachers.previewDeparture.useQuery(
    { id: teacher.id, effectiveDate: previewDate ?? teacher.today },
    { enabled: previewDate !== null, retry: false, staleTime: 0 },
  );
  const save = useDepartureSave({ onClose, setError, setPreviewDate });
  const submit = (event: FormEvent<HTMLFormElement>): void =>
    submitDeparture(event, {
      save,
      date,
      teacher,
      setError,
      first,
      previewDate,
      setPreviewDate,
      preview,
    });
  return {
    saveIsPending: save.isPending,
    onClose: onClose,
    first: first,
    teacher: teacher,
    submit: submit,
    date: date,
    error: error,
    setDate: setDate,
    setPreviewDate: setPreviewDate,
    setError: setError,
    previewDate: previewDate,
    previewIsFetching: preview.isFetching,
    previewIsError: preview.isError,
    previewError: preview.error,
    previewRefetch: () => void preview.refetch(),
    previewData: preview.data,
  };
}

function useDepartureSave({
  onClose,
  setError,
  setPreviewDate,
}: Pick<
  DepartureContentProps,
  "onClose" | "setError" | "setPreviewDate"
>): SubmitDepartureContext["save"] {
  const utils = trpc.useUtils();
  return trpc.teachers.depart.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.teachers.invalidate(), utils.classes.invalidate()]);
      onClose();
    },
    onError: (cause) => {
      setError(cause.message);
      setPreviewDate(null);
    },
  });
}

function departureSaveLabel(props: DepartureFooterProps): string {
  if (props.saveIsPending) return "Confirmando…";
  return props.previewDate && props.previewData ? "Confirmar encerramento" : "Ver impactos";
}
