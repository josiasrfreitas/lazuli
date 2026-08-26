"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from "react";

import { cva } from "class-variance-authority";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

export type StepperItem = {
  label: string;
  /** Marks a step the flow cannot reach yet (e.g. an "em breve" stage). */
  disabled?: boolean;
};

export type StepperStepState = "complete" | "current" | "pending" | "disabled";

const stepIndicatorVariants = cva(
  "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast ease-standard",
  {
    variants: {
      state: {
        complete: "border-primary bg-primary text-primary-foreground",
        current: "border-primary bg-transparent text-foreground",
        pending: "border-border-strong bg-transparent text-muted-foreground",
        disabled: "border-border bg-transparent text-muted-foreground",
      },
    },
  },
);

const stepLabelVariants = cva("text-caption transition-colors duration-fast ease-standard", {
  variants: {
    state: {
      complete: "text-foreground",
      current: "font-semibold text-foreground",
      pending: "text-muted-foreground",
      disabled: "text-muted-foreground",
    },
  },
});

function deriveState({
  activeIndex,
  index,
  step,
}: {
  activeIndex: number;
  index: number;
  step: StepperItem;
}): StepperStepState {
  if (step.disabled) {
    return "disabled";
  }
  if (index < activeIndex) {
    return "complete";
  }

  return index === activeIndex ? "current" : "pending";
}

function StepIndicator({ index, state }: { index: number; state: StepperStepState }): ReactElement {
  return (
    <span className={stepIndicatorVariants({ state })} data-slot="stepper-indicator">
      {state === "complete" ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <span className="font-numeric text-micro font-semibold tabular-nums">{index + 1}</span>
      )}
    </span>
  );
}

export type StepperProps = ComponentPropsWithoutRef<"ol"> & {
  steps: StepperItem[];
  /** Index of the current step, 0-based. Earlier steps read as complete. */
  activeIndex: number;
  /** Accessible name of the step list. */
  label?: string;
};

/**
 * Horizontal step indicator for wizards. Purely presentational: it renders
 * the position the caller reports and never owns navigation.
 */
export const Stepper = forwardRef<HTMLOListElement, StepperProps>(
  ({ activeIndex, className, label = "Etapas", steps, ...props }, ref) => (
    <ol
      {...props}
      aria-label={label}
      className={cn("flex items-center gap-3", className)}
      data-slot="stepper"
      ref={ref}
    >
      {steps.map((step, index) => {
        const state = deriveState({ activeIndex, index, step });

        return (
          <li
            aria-current={state === "current" ? "step" : undefined}
            aria-disabled={state === "disabled" || undefined}
            className={cn("flex items-center gap-3", state === "disabled" && "opacity-disabled")}
            data-slot="stepper-step"
            data-state={state}
            key={step.label}
          >
            {index > 0 ? <span aria-hidden="true" className="h-px w-6 bg-border" /> : null}
            <span className="flex items-center gap-2">
              <StepIndicator index={index} state={state} />
              <span className={stepLabelVariants({ state })}>
                {step.label}
                {state === "complete" ? <span className="sr-only"> (concluída)</span> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  ),
);

Stepper.displayName = "Stepper";
