import type { ReactElement } from "react";
import { CalendarClock, CircleMinus, FileText, ListChecks, Plus } from "lucide-react";
import {
  cn,
  Button,
  Checkbox,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Input,
  Label,
  Textarea,
} from "@lazuli/ui";
import { saoPauloDateOnly } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR as date } from "~/lib/format";
import { maskDateBR } from "~/lib/masks";
import { originLabel } from "~/features/installments/view-model";
import { treatmentGroups } from "./treatment-groups";
import type { TreatmentRow, TreatmentState } from "./use-treatment";

type StateProps = { state: TreatmentState };
const CENTS_PER_REAL = 100;
const DECIMAL_PLACES = 2;
export function TreatmentInstallments({ state }: StateProps): ReactElement {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="size-4" aria-hidden /> Parcelas
        </span>
      }
      description={`${state.chosen.length} selecionada(s) · ${money(state.balance)} em aberto`}
      action={
        !state.showAll && (
          <Button type="button" variant="ghost" size="sm" onClick={state.showAllRows}>
            <Plus aria-hidden /> Incluir
          </Button>
        )
      }
    >
      <SelectionStatus state={state} />
      <SelectionList state={state} />
      {state.showAll && state.available.hasNextPage && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={state.available.isFetchingNextPage}
          onClick={() => void state.available.fetchNextPage()}
        >
          {state.available.isFetchingNextPage ? "Carregando…" : "Carregar mais parcelas"}
        </Button>
      )}
      <SelectionErrors state={state} />
      {state.charges > 0 && (
        <p className="text-caption text-muted-foreground">
          Redução em R$ 0,00 mantém os encargos. O principal é preservado.
        </p>
      )}
    </FormSection>
  );
}
function SelectionList({ state }: StateProps): ReactElement | null {
  const visible = state.showAll ? state.rows : state.chosen;
  if (visible.length === 0) return null;
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-muted px-3 py-2 text-caption text-muted-foreground">
        {state.showAll && (
          <Checkbox
            name="select-all-installments"
            aria-label="Selecionar parcelas carregadas, até 100"
            checked={state.chosen.length === state.rows.length}
            indeterminate={state.chosen.length > 0 && state.chosen.length < state.rows.length}
            onCheckedChange={state.toggleAll}
          />
        )}
        <span className="min-w-0 flex-1">Parcela / vencimento</span>
        <span>Saldo</span>
      </div>
      <div
        className="scrollbar-subtle max-h-80 overflow-y-auto"
        aria-label="Parcelas disponíveis para negociação"
      >
        {treatmentGroups(visible).map((group) => (
          <section key={group.key} aria-label={group.name}>
            {state.batch && (
              <h3 className="border-b border-border bg-muted px-3 py-2 text-caption font-semibold">
                {group.name}
              </h3>
            )}
            <ul className="divide-y divide-border">
              {group.rows.map((row) => (
                <InstallmentChoice key={row.id} row={row} state={state} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
function SelectionStatus({ state }: StateProps): ReactElement {
  return (
    <>
      {state.available.isPending && (
        <p role="status" className="text-caption text-muted-foreground">
          Carregando parcelas…
        </p>
      )}
      {state.available.isError && (
        <div role="alert" className="text-caption">
          Não foi possível carregar as parcelas.{" "}
          <Button
            type="button"
            variant="link"
            size="inline"
            onClick={() => void state.available.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {!state.available.isPending && !state.available.isError && state.rows.length === 0 && (
        <p className="text-caption text-muted-foreground">
          Nenhuma parcela em aberto para negociar.
        </p>
      )}
    </>
  );
}
function SelectionErrors({ state }: StateProps): ReactElement {
  const missing = state.selected.filter((id) => !state.rows.some((row) => row.id === id));
  return (
    <>
      {missing.length > 0 && !state.available.isPending && !state.available.isError && (
        <p role="alert" className="text-caption text-destructive">
          Há parcelas indisponíveis na seleção.{" "}
          <Button
            type="button"
            variant="link"
            size="inline"
            onClick={() => {
              for (const id of missing) state.toggle(id, false);
            }}
          >
            Remover indisponíveis
          </Button>
        </p>
      )}
      {state.errors.selection && (
        <p role="alert" className="text-caption text-destructive">
          {state.errors.selection}
        </p>
      )}
      {state.errors.action && (
        <p role="alert" className="text-caption text-destructive">
          {state.errors.action}
        </p>
      )}
    </>
  );
}
function InstallmentChoice({ row, state }: { row: TreatmentRow } & StateProps): ReactElement {
  const checked = state.selected.includes(row.id);
  const label = `${originLabel(row.origin)} · ${row.sequenceNumber}`;
  return (
    <li className={cn("grid gap-2 px-3 py-2.5", checked && "bg-accent/40")}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Checkbox
          id={`treatment-parcel-${row.id}`}
          name={`parcel-${row.id}`}
          checked={checked}
          invalid={Boolean(state.errors.selection)}
          aria-label={`Selecionar ${label}, vencimento ${date(row.dueDate)}, ${row.party.name}`}
          onCheckedChange={(value) => state.toggle(row.id, value)}
        />
        <label
          htmlFor={`treatment-parcel-${row.id}`}
          className="grid min-w-0 flex-1 cursor-pointer gap-0.5 text-caption"
        >
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-muted-foreground">
            {date(row.dueDate)}
            {row.suspendedUntil && row.suspendedUntil >= saoPauloDateOnly(new Date())
              ? " · Suspensa"
              : ""}
          </span>
        </label>
        <div className="text-right text-caption">
          <p className="font-numeric font-semibold">{money(row.balanceCents)}</p>
          <p className="text-muted-foreground">
            {row.chargesCents > 0 ? `Encargos: ${money(row.chargesCents)}` : "Sem encargos"}
          </p>
        </div>
      </div>
      {checked && row.chargesCents > 0 && <ReductionField row={row} state={state} />}
    </li>
  );
}
function ReductionField({ row, state }: { row: TreatmentRow } & StateProps): ReactElement {
  const label = `${originLabel(row.origin)} · ${row.sequenceNumber}, ${row.party.name}`;
  return (
    <div className="min-w-0 pl-7">
      <Field>
        <Label htmlFor={`reduction-${row.id}`}>
          <span className="flex flex-wrap items-center gap-1.5">
            <CircleMinus className="size-3.5" aria-hidden />
            Redução de encargos{" "}
            <span className="font-normal text-muted-foreground">até {money(row.chargesCents)}</span>
          </span>
        </Label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-24 min-w-0">
            <Input
              id={`reduction-${row.id}`}
              name={`reduction-${row.id}`}
              aria-label={`Redução de ${label}`}
              autoComplete="off"
              placeholder="0,00"
              inputMode="decimal"
              size="sm"
              invalid={Boolean(state.errors[row.id] || state.errors.action)}
              value={state.amounts[row.id] ?? "0,00"}
              onChange={(event) => state.changeAmount(row.id, event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Perdoar encargos de ${label}`}
            onClick={() =>
              state.changeAmount(
                row.id,
                (row.chargesCents / CENTS_PER_REAL).toFixed(DECIMAL_PLACES).replace(".", ","),
              )
            }
          >
            Perdoar encargos
          </Button>
        </div>
        {state.errors[row.id] && <FieldError match>{state.errors[row.id]}</FieldError>}
      </Field>
    </div>
  );
}
export function TreatmentConditions({ state }: StateProps): ReactElement {
  return (
    <div className="grid content-start gap-5">
      {state.batch && (
        <p className="text-caption text-muted-foreground">
          A suspensão e o motivo se aplicam a todas as parcelas selecionadas. Defina a redução de
          encargos em cada linha.
        </p>
      )}
      {state.chosen.length === 0 ? (
        <p className="py-3 text-caption text-muted-foreground">
          Selecione as parcelas para definir as condições do acordo.
        </p>
      ) : (
        <>
          <SuspensionFields state={state} />
          <ReasonField state={state} />
        </>
      )}
    </div>
  );
}
function SuspensionFields({ state }: StateProps): ReactElement {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden />
          {state.suspensionOnly ? "Novo vencimento" : "Suspensão da cobrança"}
        </span>
      }
      description={
        state.suspensionOnly
          ? "Sem encargos em aberto. Defina até quando suspender a cobrança."
          : undefined
      }
      action={
        !state.suspensionOnly && (
          <Checkbox
            name="suspend"
            aria-label="Suspender cobrança e definir novo vencimento"
            checked={state.suspension}
            onCheckedChange={state.changeSuspension}
          />
        )
      }
    >
      {state.suspension ? (
        <>
          <SuspensionDate state={state} />
          <p className="text-caption text-muted-foreground">
            Sem novos juros até essa data. O atraso recomeça no dia seguinte.
          </p>
        </>
      ) : (
        <p className="text-caption text-muted-foreground">Mantém os vencimentos atuais.</p>
      )}
    </FormSection>
  );
}
function SuspensionDate({ state }: StateProps): ReactElement {
  return (
    <FormRow>
      <Field className="max-w-36">
        <Label htmlFor="treatment-until">Suspender até</Label>
        <Input
          id="treatment-until"
          name="until"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          size="sm"
          value={state.until}
          invalid={Boolean(state.errors.until)}
          onChange={(event) => state.changeUntil(maskDateBR(event.target.value))}
        />
        {state.errors.until && <FieldError match>{state.errors.until}</FieldError>}
      </Field>
    </FormRow>
  );
}
function ReasonField({ state }: StateProps): ReactElement {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <FileText className="size-4" aria-hidden /> Motivo do acordo
        </span>
      }
    >
      <Field>
        <Label htmlFor="treatment-reason" className="sr-only">
          Motivo do acordo
        </Label>
        <Textarea
          id="treatment-reason"
          name="reason"
          autoComplete="off"
          rows={3}
          maxLength={2000}
          placeholder="Ex.: responsável solicitou prazo até o próximo recebimento."
          value={state.reason}
          invalid={Boolean(state.errors.reason)}
          onChange={(event) => state.changeReason(event.target.value)}
        />
        {state.errors.reason && <FieldError match>{state.errors.reason}</FieldError>}
      </Field>
    </FormSection>
  );
}
