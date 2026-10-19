import {
  CalendarClock,
  CircleMinus,
  FileText,
  ListChecks,
  Plus,
  ReceiptText,
  UserRound,
} from "lucide-react";
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

export function TreatmentInstallments({ state }: { state: TreatmentState }) {
  const visible = state.showAll ? state.rows : state.chosen;
  return (
    <FormSection
      className="self-start"
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="size-4" aria-hidden /> Parcelas
        </span>
      }
      description={`${state.chosen.length} selecionada${state.chosen.length === 1 ? "" : "s"} · ${money(state.balance)} em aberto`}
      action={
        !state.showAll && (
          <Button type="button" variant="ghost" size="sm" onClick={state.showAllRows}>
            <Plus aria-hidden className="size-4" /> Incluir
          </Button>
        )
      }
    >
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
      {visible.length > 0 && (
        <div className="min-w-0 overflow-hidden rounded-md border border-border">
          <div
            className={cn(
              "flex items-center gap-3 border-b border-border bg-muted px-3 py-2 text-caption text-muted-foreground",
              state.batch && "lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-4",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {state.showAll && (
                <Checkbox
                  name="select-all-installments"
                  aria-label="Selecionar todas as parcelas"
                  checked={state.chosen.length === state.rows.length}
                  indeterminate={state.chosen.length > 0 && state.chosen.length < state.rows.length}
                  onCheckedChange={state.toggleAll}
                />
              )}
              <span className="min-w-0 flex-1">Parcela / vencimento</span>
              <span className={state.batch ? "hidden lg:inline" : ""}>Saldo</span>
            </div>
            {state.batch && <span className="hidden pl-4 lg:inline">Redução de encargos</span>}
          </div>
          <div
            className={
              state.batch
                ? "scrollbar-subtle max-h-96 overflow-y-auto lg:max-h-[min(32rem,calc(100dvh-24rem))]"
                : "scrollbar-subtle max-h-64 overflow-y-auto md:max-h-80"
            }
            aria-label="Parcelas disponíveis para negociação"
          >
            {treatmentGroups(visible).map((group) => (
              <section key={group.key} aria-label={group.name}>
                {state.batch && (
                  <div className="flex min-w-0 items-start gap-2 border-b border-border bg-muted px-3 py-2">
                    <UserRound
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <h3 className="break-words text-caption font-semibold">{group.name}</h3>
                      <p className="text-caption text-muted-foreground">
                        {group.rows.filter((row) => state.selected.includes(row.id)).length} de{" "}
                        {group.rows.length} selecionada{group.rows.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
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
      )}
      {state.selected.length > state.chosen.length &&
        !state.available.isPending &&
        !state.available.isError && (
          <p role="alert" className="text-caption text-destructive">
            Há parcelas indisponíveis na seleção.{" "}
            <Button
              type="button"
              variant="link"
              size="inline"
              onClick={() => {
                state.selected
                  .filter((id) => !state.rows.some((row) => row.id === id))
                  .forEach((id) => state.toggle(id, false));
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
      {state.charges > 0 && (
        <p className="text-caption text-muted-foreground">
          Redução em R$ 0,00 mantém os encargos. O principal é preservado.
        </p>
      )}
    </FormSection>
  );
}

function InstallmentChoice({ row, state }: { row: TreatmentRow; state: TreatmentState }) {
  const checked = state.selected.includes(row.id);
  const label = `${originLabel(row.origin)} · ${row.sequenceNumber}`;
  return (
    <li
      className={cn(
        "grid gap-2 px-3 py-2.5",
        checked && "bg-accent/40",
        state.batch && "lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center lg:gap-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 max-[359px]:flex-wrap">
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
        <div className="shrink-0 text-right text-caption max-[359px]:w-full max-[359px]:pl-7 max-[359px]:text-left">
          <p className="font-numeric font-semibold text-foreground">{money(row.balanceCents)}</p>
          <p className="text-muted-foreground">
            {row.chargesCents > 0 ? `Encargos: ${money(row.chargesCents)}` : "Sem encargos"}
          </p>
        </div>
      </div>
      {checked && row.chargesCents > 0 && (
        <div className={cn("min-w-0 pl-7", state.batch && "lg:border-l lg:border-border lg:pl-4")}>
          <Field className="min-w-0">
            <Label htmlFor={`reduction-${row.id}`}>
              <span className="flex flex-wrap items-center gap-1.5">
                <CircleMinus className="size-3.5 shrink-0" aria-hidden />
                Redução de encargos
                <span className="font-normal text-muted-foreground">
                  até {money(row.chargesCents)}
                </span>
              </span>
            </Label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className={state.batch ? "w-16 min-w-0 lg:w-20" : "w-24 min-w-0 sm:w-28"}>
                <Input
                  id={`reduction-${row.id}`}
                  name={`reduction-${row.id}`}
                  aria-label={`Redução de ${label}, ${row.party.name}`}
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
                aria-label={`Perdoar encargos de ${label}, ${row.party.name}`}
                onClick={() =>
                  state.changeAmount(row.id, (row.chargesCents / 100).toFixed(2).replace(".", ","))
                }
              >
                Perdoar encargos
              </Button>
            </div>
            {state.errors[row.id] && <FieldError match>{state.errors[row.id]}</FieldError>}
          </Field>
        </div>
      )}
    </li>
  );
}

export function TreatmentConditions({ state }: { state: TreatmentState }) {
  return (
    <div className="grid content-start gap-5">
      {state.batch && (
        <p className="text-caption text-muted-foreground">
          A suspensão e o motivo se aplicam a todas as parcelas selecionadas. Defina a redução de
          encargos em cada linha.
        </p>
      )}
      {state.chosen.length === 0 ? (
        <div className="flex items-start gap-3 py-3 text-caption text-muted-foreground">
          <ReceiptText className="size-5 shrink-0" aria-hidden />
          <p>Selecione as parcelas para definir as condições do acordo.</p>
        </div>
      ) : (
        <>
          <FormSection
            title={
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden />{" "}
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
                <FormRow className="grid-cols-1 items-center min-[360px]:grid-cols-[9rem_minmax(0,1fr)]">
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
                  <p className="text-caption text-muted-foreground">
                    {state.chosen.length > 1
                      ? "Novo vencimento para todas as selecionadas."
                      : "Novo vencimento desta parcela."}
                  </p>
                </FormRow>
                <p className="text-caption text-muted-foreground">
                  Sem novos juros até essa data. O atraso recomeça no dia seguinte.
                  {state.charges > 0 && " As reduções são definidas em cada parcela."}
                </p>
              </>
            ) : (
              <p className="text-caption text-muted-foreground">Mantém os vencimentos atuais.</p>
            )}
          </FormSection>
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
        </>
      )}
    </div>
  );
}
