"use client";
import type { ReactElement } from "react";
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
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { TextControl } from "~/features/classes/form-controls";
import { GradeFields } from "./grade-fields";
import { useAssessmentForm } from "./use-assessment-form";
import { PHASES, PHASE_LABELS, type Assessment } from "./shared";

export function AssessmentDialog({
  data,
  onClose,
}: {
  data: Assessment;
  onClose: () => void;
}): ReactElement {
  const state = useAssessmentForm(data, onClose);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.save.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={() => document.getElementById("grade-0")}>
          <DialogHeader>
            <DialogTitle>Notas · {data.stage.name}</DialogTitle>
            <DialogDescription>
              {data.student.fullName}. Deixe em branco as notas ainda não avaliadas.
            </DialogDescription>
          </DialogHeader>
          <DialogBody ref={state.body}>
            <form
              id="assessment-form"
              noValidate
              onSubmit={state.submit}
              className="grid gap-5 pt-4"
            >
              <SegmentedControl
                aria-label="Bloco de avaliação"
                value={state.phase}
                onValueChange={(value) => {
                  if (PHASES.includes(value as typeof state.phase))
                    state.setPhase(value as typeof state.phase);
                }}
              >
                {PHASES.map((phase) => (
                  <SegmentedControlItem key={phase} value={phase}>
                    {PHASE_LABELS[phase]}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
              {state.grades.map(
                (grade, index) =>
                  grade.phase === state.phase && (
                    <GradeFields
                      key={grade.competence}
                      grade={grade}
                      index={index}
                      errors={state.errors}
                      onChange={state.change}
                    />
                  ),
              )}
              {data.confirmedAt && (
                <TextControl
                  name="assessment-correction"
                  label="Justificativa da correção"
                  placeholder="Por que as notas confirmadas precisam mudar?"
                  value={state.reason}
                  onChange={state.setReason}
                />
              )}
              {data.confirmedAt && (
                <Alert variant="warning">
                  Salvar a correção retira a confirmação anterior. A coordenação precisará confirmar
                  o resultado novamente.
                </Alert>
              )}
              {state.save.error && <Alert variant="destructive">{state.save.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={state.save.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="assessment-form" disabled={state.save.isPending}>
              {state.save.isPending ? "Salvando…" : "Salvar notas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
