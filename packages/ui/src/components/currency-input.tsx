"use client";

import type { ClipboardEvent, KeyboardEvent, ReactElement, SyntheticEvent } from "react";

import {
  appendCurrencyDigit,
  formatCurrencyCents,
  parseCurrencyDigits,
  removeCurrencyDigit,
} from "../lib/currency-input-value";
import { Input, type InputProps } from "./input";

export type CurrencyInputProps = Omit<
  InputProps,
  "defaultValue" | "inputMode" | "onChange" | "type" | "value"
> & {
  /** Controlled value in centavos; null leaves the input empty. */
  value: number | null;
  onValueChange: (cents: number | null) => void;
};

function moveCaretToEnd(input: HTMLInputElement): void {
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function handleCaretEvent<E extends SyntheticEvent<HTMLInputElement>>(
  event: E,
  callback?: (event: E) => void,
): void {
  callback?.(event);
  if (!event.defaultPrevented) moveCaretToEnd(event.currentTarget);
}

function selectedAll(input: HTMLInputElement): boolean {
  return (
    input.value.length > 0 &&
    input.selectionStart === 0 &&
    input.selectionEnd === input.value.length
  );
}

function nextKeyValue(
  event: KeyboardEvent<HTMLInputElement>,
  value: number | null,
): number | null | undefined {
  const current = selectedAll(event.currentTarget) ? null : value;
  if (/^\d$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return appendCurrencyDigit(current, event.key);
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    return selectedAll(event.currentTarget) ? null : removeCurrencyDigit(value);
  }
  return undefined;
}

function handleCurrencyChange(
  input: HTMLInputElement,
  state: {
    inputType: string | undefined;
    value: number | null;
    onValueChange: CurrencyInputProps["onValueChange"];
  },
): void {
  if (!input.value) {
    state.onValueChange(null);
    return;
  }
  if (state.inputType?.startsWith("delete")) {
    state.onValueChange(removeCurrencyDigit(state.value));
    return;
  }
  const cents = parseCurrencyDigits(input.value);
  if (cents !== undefined) state.onValueChange(cents);
}

function handleCurrencyPaste(
  event: ClipboardEvent<HTMLInputElement>,
  state: {
    disabled: boolean | undefined;
    onPaste: CurrencyInputProps["onPaste"];
    onValueChange: CurrencyInputProps["onValueChange"];
    readOnly: boolean | undefined;
  },
): void {
  state.onPaste?.(event);
  if (event.defaultPrevented || state.readOnly || state.disabled) return;
  event.preventDefault();
  const cents = parseCurrencyDigits(event.clipboardData.getData("text"));
  if (cents !== undefined) state.onValueChange(cents);
}

/** BRL input: each typed digit shifts the value by one decimal place. */
export function CurrencyInput({
  disabled,
  onClick,
  onFocus,
  onKeyDown,
  onPaste,
  onValueChange,
  placeholder = "R$ 0,00",
  readOnly,
  value,
  ...props
}: CurrencyInputProps): ReactElement {
  const pasteState = { onPaste, readOnly, disabled, onValueChange };
  return (
    <Input
      {...props}
      data-currency-input=""
      disabled={disabled}
      inputMode="numeric"
      onChange={(event) => {
        if (readOnly || disabled) return;
        handleCurrencyChange(event.currentTarget, {
          inputType: (event.nativeEvent as InputEvent).inputType,
          value,
          onValueChange,
        });
      }}
      onClick={(event) => handleCaretEvent(event, onClick)}
      onFocus={(event) => handleCaretEvent(event, onFocus)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || readOnly || disabled || event.nativeEvent.isComposing) return;
        const next = nextKeyValue(event, value);
        if (next === undefined) return;
        event.preventDefault();
        onValueChange(next);
      }}
      onPaste={(event) => handleCurrencyPaste(event, pasteState)}
      placeholder={placeholder}
      readOnly={readOnly}
      type="text"
      value={formatCurrencyCents(value)}
    />
  );
}
