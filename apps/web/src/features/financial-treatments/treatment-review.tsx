import type { ReactElement } from "react";
import { ArrowRight, CalendarClock, Pencil } from "lucide-react";
import { Button } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR as date } from "~/lib/format";
import { originLabel } from "~/features/installments/view-model";
import { treatmentGroups } from "./treatment-groups";
import type { TreatmentReview } from "./use-treatment";

type ReviewLine = TreatmentReview["result"]["lines"][number];
export function TreatmentReviewPanel({
  review,
  onEdit,
}: {
  review: TreatmentReview;
  onEdit: () => void;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2 md:gap-6">
      <section className="min-w-0" aria-label="Parcelas do acordo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-control font-semibold text-heading">
            {review.result.lines.length} parcela(s) no acordo
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden /> Alterar
          </Button>
        </div>
        <div className="scrollbar-subtle max-h-80 overflow-y-auto">
          {treatmentGroups(review.result.lines).map((group) => (
            <section key={group.key} aria-label={group.name}>
              <h3 className="border-y border-border bg-muted px-3 py-2 text-caption font-semibold">
                {group.name}
              </h3>
              <ul className="divide-y divide-border px-3">
                {group.rows.map((line) => (
                  <ReviewItem key={line.installmentId} line={line} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
      <ReviewConditions review={review} />
    </div>
  );
}
function ReviewItem({ line }: { line: ReviewLine }): ReactElement {
  return (
    <li className="grid gap-1.5 py-3 text-caption">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="font-medium">
          {originLabel(line.origin)} · {line.sequenceNumber}
        </strong>
        <span className="flex items-center gap-2 font-numeric">
          <span className="text-muted-foreground">{money(line.balanceCents)}</span>
          <ArrowRight className="size-3" aria-label="para" />
          <strong>{money(line.resultingBalanceCents)}</strong>
        </span>
      </div>
      <p className="text-muted-foreground">
        {line.reductionCents > 0
          ? `Redução de ${money(line.reductionCents)} em encargos`
          : "Sem redução de encargos"}
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        <CalendarClock className="size-3.5" aria-hidden />
        {line.newDueDate
          ? `${date(line.previousDueDate)} → ${date(line.newDueDate)}`
          : `Vencimento mantido em ${date(line.previousDueDate)}`}
      </p>
    </li>
  );
}
function ReviewConditions({ review }: { review: TreatmentReview }): ReactElement {
  const reduction = review.result.lines.reduce((sum, line) => sum + line.reductionCents, 0);
  return (
    <section
      className="grid min-w-0 content-start gap-4 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6"
      aria-label="Resumo do acordo"
    >
      <h3 className="text-control font-semibold text-heading">Condições combinadas</h3>
      {reduction > 0 && (
        <p className="text-caption">
          <strong className="font-numeric">{money(reduction)}</strong> de redução nos encargos em
          aberto.
        </p>
      )}
      {review.request.newDueDate && (
        <p className="text-caption">
          Cobrança suspensa até <strong>{date(review.request.newDueDate)}</strong>, novo vencimento
          das parcelas selecionadas. Sem novos juros durante a suspensão.
        </p>
      )}
      <div className="grid gap-1.5">
        <h4 className="text-caption text-muted-foreground">Motivo</h4>
        <p className="whitespace-pre-wrap break-words text-control">{review.reason}</p>
      </div>
      <p className="text-caption text-muted-foreground">
        Pagamentos anteriores e valor principal preservados. Esta confirmação registra o acordo; o
        recebimento é lançado separadamente.
      </p>
    </section>
  );
}
