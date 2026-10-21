import type { JSX as ReactJSX } from "react";
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

export function IntakeDialogHeading({
  continuing,
  step,
  name,
  hasEnrollment,
  hasClass,
}: {
  continuing: boolean;
  step: "student" | "pedagogy" | "contract";
  name: string;
  hasEnrollment: boolean;
  hasClass: boolean;
}): ReactJSX.Element {
  const description =
    step === "student"
      ? continuing
        ? "Confira os dados do aluno e continue pelas etapas pendentes."
        : "Busque um lead ou preencha os dados do aluno."
      : step === "pedagogy"
        ? hasEnrollment
          ? "Confira a turma definida para este aluno e continue para o contrato."
          : `Escolha a turma para ${name} ou deixe essa definição pendente.`
        : "Defina o contrato e confirme o cadastro. As alterações serão salvas ao confirmar.";
  return (
    <div className={styles.dialogHeading} data-wide={step !== "student"}>
      <DialogHeader>
        <DialogTitle>{continuing ? "Continuar cadastro" : "Novo aluno"}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Stepper
        steps={[
          { label: "Aluno" },
          { label: "Pedagógico", completed: hasClass },
          { label: "Contrato" },
        ]}
        activeIndex={step === "contract" ? 2 : step === "pedagogy" ? 1 : 0}
        label="Entrada do aluno"
      />
    </div>
  );
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
        <DialogContent className={studentDialogClassName}>
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
