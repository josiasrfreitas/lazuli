"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from "react";

import { cva } from "class-variance-authority";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

const MUTED_FOREGROUND = "text-muted-foreground";
const COMPLETE_DISABLED = "complete-disabled";

export type StepperItem = {
  label: string;
  /** Keeps an earlier step pending when the flow allows it to be deferred. */
  completed?: boolean;
  /** Prevents navigation, including completed steps that are no longer editable. */
  disabled?: boolean;
};

export type StepperStepState =
  | "complete"
  | "complete-disabled"
  | "current"
  | "pending"
  | "disabled";

const stepIndicatorVariants = cva(
  "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast ease-standard",
  {
    variants: {
      state: {
        complete: "border-primary bg-primary text-primary-foreground",
        [COMPLETE_DISABLED]: "border-success bg-transparent text-success",
        current: "border-selection-indicator bg-accent text-accent-foreground",
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
      [COMPLETE_DISABLED]: MUTED_FOREGROUND,
      current: "font-semibold text-foreground",
      pending: MUTED_FOREGROUND,
      disabled: MUTED_FOREGROUND,
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
  if (step.disabled && step.completed) return COMPLETE_DISABLED;
  if (step.disabled) {
    return "disabled";
  }
  if (index < activeIndex && step.completed !== false) {
    return "complete";
  }

  return index === activeIndex ? "current" : "pending";
}

function StepIndicator({ index, state }: { index: number; state: StepperStepState }): ReactElement {
  return (
    <span className={stepIndicatorVariants({ state })} data-slot="stepper-indicator">
      {state === "complete" || state === COMPLETE_DISABLED ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <span className="translate-y-px font-numeric text-micro leading-none font-semibold tabular-nums">
          {index + 1}
        </span>
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
  onStepChange?: ((index: number) => void) | undefined;
};

function StepperStep({
  activeIndex,
  index,
  onStepChange,
  step,
}: {
  activeIndex: number;
  index: number;
  onStepChange?: ((index: number) => void) | undefined;
  step: StepperItem;
}): ReactElement {
  const state = deriveState({ activeIndex, index, step });
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      aria-disabled={step.disabled || undefined}
      className={cn("flex items-center gap-3", step.disabled && "opacity-disabled")}
      data-slot="stepper-step"
      data-state={state}
    >
      {index > 0 ? <span aria-hidden="true" className="h-px w-6 bg-border" /> : null}
      <span className="flex items-center gap-2">
        {onStepChange ? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            disabled={step.disabled}
            onClick={() => onStepChange(index)}
          >
            <StepIndicator index={index} state={state} />
            <span className={stepLabelVariants({ state })}>
              {step.label}
              {state === COMPLETE_DISABLED && <span className="sr-only"> (concluída)</span>}
            </span>
          </button>
        ) : (
          <>
            <StepIndicator index={index} state={state} />
            <span className={stepLabelVariants({ state })}>
              {step.label}
              {state === "complete" || state === COMPLETE_DISABLED ? (
                <span className="sr-only"> (concluída)</span>
              ) : null}
            </span>
          </>
        )}
      </span>
    </li>
  );
}

/**
 * Horizontal step indicator for wizards. An optional callback enables navigation.
 */
export const Stepper = forwardRef<HTMLOListElement, StepperProps>(
  ({ activeIndex, className, label = "Etapas", steps, onStepChange, ...props }, ref) => (
    <ol
      {...props}
      aria-label={label}
      className={cn("flex items-center gap-3", className)}
      data-slot="stepper"
      ref={ref}
    >
      {steps.map((step, index) => (
        <StepperStep
          activeIndex={activeIndex}
          index={index}
          key={step.label}
          onStepChange={onStepChange}
          step={step}
        />
      ))}
    </ol>
  ),
);

Stepper.displayName = "Stepper";
