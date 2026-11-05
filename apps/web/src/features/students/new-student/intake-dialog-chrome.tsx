import type { JSX as ReactJSX, ReactNode } from "react";
import {
  ToastAlert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  PencilLoader,
  Stepper,
} from "@lazuli/ui";
import styles from "./intake-schedule.module.css";

export const studentDialogClassName = `w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] md:max-w-2xl ${styles.studentDialog}`;
type IntakeHeadingProps = {
  continuing: boolean;
  step: "student" | "address" | "pedagogy" | "contract";
  hasClass: boolean;
  hasStudent: boolean;
  hasAddress: boolean;
  hasContract?: boolean;
  compact?: boolean;
  avatar?: ReactNode;
  pedagogyControls?: ReactNode;
  onStepChange: (step: "student" | "address" | "pedagogy" | "contract") => void;
};

function stepIndex(step: "student" | "address" | "pedagogy" | "contract"): number {
  const CONTRACT_STEP_INDEX = 3;
  if (step === "contract") return CONTRACT_STEP_INDEX;
  if (step === "pedagogy") return 2;
  if (step === "address") return 1;
  return 0;
}

export function IntakeDialogHeading({
  continuing,
  step,
  hasClass,
  hasStudent,
  hasAddress,
  hasContract = false,
  compact = false,
  avatar,
  pedagogyControls,
  onStepChange,
}: IntakeHeadingProps): ReactJSX.Element {
  const description = intakeDialogDescription({ continuing, step });
  return (
    <div
      className={styles.dialogHeading}
      data-wide={step !== "student" && step !== "address"}
      data-compact={compact}
      data-pedagogy={step === "pedagogy"}
    >
      {step !== "pedagogy" && (
        <div className="flex min-w-0 items-center gap-3">
          {avatar && <div className="shrink-0">{avatar}</div>}
          <DialogHeader className="min-w-0 flex-1 shrink">
            <DialogTitle>{continuing ? "Continuar cadastro" : "Novo aluno"}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>
      )}
      {step === "pedagogy" && (
        <DialogHeader className={`${styles.pedagogyTitle} pr-0`}>
          <DialogTitle>Turma de entrada</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha o período de entrada e, se possível, a turma do aluno.
          </DialogDescription>
        </DialogHeader>
      )}
      {step === "pedagogy" && pedagogyControls}
      <Stepper
        steps={[
          { label: "Aluno", completed: hasStudent },
          { label: "Endereço", completed: hasAddress },
          { label: "Pedagógico", completed: hasClass },
          { label: "Contrato", completed: hasContract, disabled: hasContract },
        ]}
        onStepChange={(index) =>
          onStepChange(
            (["student", "address", "pedagogy", "contract"] as const)[index] ?? "student",
          )
        }
        activeIndex={stepIndex(step)}
        label="Entrada do aluno"
      />
    </div>
  );
}

function intakeDialogDescription({
  continuing,
  step,
}: {
  continuing: boolean;
  step: "student" | "address" | "pedagogy" | "contract";
}): string {
  if (step === "student")
    return continuing
      ? "Confira os dados do aluno e continue pelas etapas pendentes."
      : "Busque um lead ou preencha os dados do aluno.";
  if (step === "address")
    return "Busque o endereço do aluno e confira os dados. Você também pode preencher manualmente.";
  if (step === "pedagogy") return "";
  return "Defina o contrato e confirme o cadastro. As alterações serão salvas ao confirmar.";
}

export function IntakeDialogLoading({
  error,
  onRetry,
  onClose,
}: {
  error: string | undefined;
  onRetry: () => void;
  onClose: () => void;
}): ReactJSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-[min(44rem,calc(100dvh-4rem))] w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Continuar cadastro</DialogTitle>
            <DialogDescription>
              Confira os dados do aluno e continue pelas etapas pendentes.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.centeredState}>
            {error ? (
              <ToastAlert variant="destructive">
                {error}
                <Button variant="secondary" onClick={onRetry}>
                  Tentar novamente
                </Button>
              </ToastAlert>
            ) : (
              <PencilLoader label="Carregando cadastro do aluno" />
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
