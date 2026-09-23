"use client";

import type { ReactElement } from "react";

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
  return (
    <Input
      {...props}
      data-currency-input=""
      disabled={disabled}
      inputMode="numeric"
      onChange={(event) => {
        if (readOnly || disabled) return;
        if (!event.currentTarget.value) {
          onValueChange(null);
          return;
        }
        if ((event.nativeEvent as InputEvent).inputType?.startsWith("delete")) {
          onValueChange(removeCurrencyDigit(value));
          return;
        }
        const cents = parseCurrencyDigits(event.currentTarget.value);
        if (cents !== undefined) onValueChange(cents);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) moveCaretToEnd(event.currentTarget);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) moveCaretToEnd(event.currentTarget);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || readOnly || disabled || event.nativeEvent.isComposing) return;
        if (/^\d$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const input = event.currentTarget;
          const selectingAll =
            input.value.length > 0 &&
            input.selectionStart === 0 &&
            input.selectionEnd === input.value.length;
          onValueChange(appendCurrencyDigit(selectingAll ? null : value, event.key));
        } else if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          const input = event.currentTarget;
          const selectingAll =
            input.value.length > 0 &&
            input.selectionStart === 0 &&
            input.selectionEnd === input.value.length;
          onValueChange(selectingAll ? null : removeCurrencyDigit(value));
        }
      }}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented || readOnly || disabled) return;
        event.preventDefault();
        const cents = parseCurrencyDigits(event.clipboardData.getData("text"));
        if (cents !== undefined) onValueChange(cents);
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      type="text"
      value={formatCurrencyCents(value)}
    />
  );
}
