import type { JSX as ReactJSX, ReactNode } from "react";
import {
  Alert,
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
  name: string;
  hasEnrollment: boolean;
  hasClass: boolean;
  hasContract?: boolean;
  compact?: boolean;
  avatar?: ReactNode;
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
  name,
  hasEnrollment,
  hasClass,
  hasContract = false,
  compact = false,
  avatar,
  onStepChange,
}: IntakeHeadingProps): ReactJSX.Element {
  const description = intakeDialogDescription({
    continuing,
    step,
    name,
    hasEnrollment,
    hasContract,
  });
  return (
    <div
      className={styles.dialogHeading}
      data-wide={step !== "student" && step !== "address"}
      data-compact={compact}
    >
      <div className="flex min-w-0 items-center gap-3">
        {avatar && <div className="shrink-0">{avatar}</div>}
        <DialogHeader className="min-w-0 flex-1 shrink">
          <DialogTitle>{continuing ? "Continuar cadastro" : "Novo aluno"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
      </div>
      <Stepper
        steps={[
          { label: "Aluno", completed: false },
          { label: "Endereço", completed: false },
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
  name,
  hasEnrollment,
  hasContract,
}: {
  continuing: boolean;
  step: "student" | "address" | "pedagogy" | "contract";
  name: string;
  hasEnrollment: boolean;
  hasContract: boolean;
}): string {
  if (step === "student")
    return continuing
      ? "Confira os dados do aluno e continue pelas etapas pendentes."
      : "Busque um lead ou preencha os dados do aluno.";
  if (step === "address")
    return "Busque o endereço do aluno e confira os dados. Você também pode preencher manualmente.";
  if (step === "pedagogy" && hasContract)
    return "Confira a turma e conclua o cadastro. O contrato já está cadastrado.";
  if (step === "pedagogy")
    return hasEnrollment
      ? "Confira a turma definida para este aluno e continue para o contrato."
      : `Escolha a turma para ${name} ou deixe essa definição pendente.`;
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
              <Alert variant="destructive">
                {error}
                <Button variant="secondary" onClick={onRetry}>
                  Tentar novamente
                </Button>
              </Alert>
            ) : (
              <PencilLoader label="Carregando cadastro do aluno" />
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
