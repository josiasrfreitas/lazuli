"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { adjacentVariant, type Variant } from "./concepts";
import { workshopEnabled } from "./config";

function useVariantKeyboard(variant: Variant, onChange: (variant: Variant) => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest("input, textarea, select, [contenteditable], [role='tablist']"))
      ) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        onChange(adjacentVariant(variant, event.key === "ArrowLeft" ? -1 : 1));
      }
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [variant, onChange]);
}

export function PrototypeSwitcher({
  variant,
  name,
  onChange,
}: {
  variant: Variant;
  name: string;
  onChange: (variant: Variant) => void;
}): ReactNode {
  useVariantKeyboard(variant, onChange);
  if (!workshopEnabled) return null;

  return (
    <nav
      aria-label="Alternar conceitos da marca"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full border border-border-strong bg-card p-2 shadow-lg"
    >
      <Button
        aria-label="Conceito anterior"
        onClick={() => onChange(adjacentVariant(variant, -1))}
        size="icon-compact-responsive"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" />
      </Button>
      <p aria-live="polite" className="text-sm">
        <span className="mr-2 font-semibold text-brand">{variant}</span>
        {name}
      </p>
      <Button
        aria-label="Próximo conceito"
        onClick={() => onChange(adjacentVariant(variant, 1))}
        size="icon-compact-responsive"
        variant="ghost"
      >
        <ArrowRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
