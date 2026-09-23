"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { summary, type TableFilterField } from "./table-filter-model";

function chipLabel(field: TableFilterField): string {
  if (field.kind === "toggle") return field.label;
  if ((field.kind === "options" || field.kind === "remote-options") && field.selected.length > 2) {
    return `${field.label} (${field.selected.length})`;
  }
  return `${field.label}: ${summary(field)}`;
}

function ActiveChip({ field }: { field: TableFilterField }): ReactElement {
  const label = chipLabel(field);
  return (
    <div
      className="flex h-control-sm max-w-[min(16rem,calc(100vw-8rem))] shrink-0 items-center overflow-hidden rounded-sm border border-border bg-muted/60 text-foreground"
      data-slot="table-filter-chip"
    >
      {field.kind === "options" || field.kind === "remote-options" ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 flex-1 rounded-r-none px-2 font-normal"
                aria-label={`Gerenciar ${field.label}: ${field.selected.length} selecionados`}
              />
            }
          >
            <span className="truncate" title={label}>
              {label}
            </span>
            <ChevronDown aria-hidden="true" className="size-3" />
          </PopoverTrigger>
          <PopoverContent
            aria-label={`Opções selecionadas de ${field.label}`}
            align="start"
            className="w-[min(18rem,calc(100vw-2rem))] p-2"
          >
            <ul className="scrollbar-subtle max-h-52 divide-y divide-border overflow-y-auto pr-2">
              {field.selected.map((id) => {
                const available = field.kind === "options" ? field.options : field.selectedOptions;
                const optionLabel =
                  available.find((option) => option.id === id)?.label ?? "Seleção indisponível";
                return (
                  <li
                    key={id}
                    className="flex min-h-control-sm min-w-0 items-center justify-between gap-2 px-2"
                  >
                    <span className="min-w-0 break-words py-1">{optionLabel}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${optionLabel} de ${field.label}`}
                      onClick={() => field.onChange(field.selected.filter((value) => value !== id))}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="min-w-0 truncate px-2 text-control" title={label}>
          {label}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-l-none border-l border-border text-muted-foreground hover:text-foreground"
        onClick={field.onClear}
        aria-label={`Remover filtro ${field.label}`}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Render directly above results; selections remain in one horizontally scrollable row. */
export function TableFilterChips({ fields }: { fields: TableFilterField[] }): ReactElement | null {
  const active = fields.filter((field) => summary(field));
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = (): void => {
      const left = node.scrollLeft > 1;
      const right = node.scrollWidth - node.clientWidth - node.scrollLeft > 1;
      setEdges((previous) =>
        previous.left === left && previous.right === right ? previous : { left, right },
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer?.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [fields]);

  if (active.length === 0) return null;
  const fadeLeft = edges.left ? "transparent 0, black 16px" : "black 0";
  const fadeRight = edges.right ? "black calc(100% - 16px), transparent 100%" : "black 100%";
  return (
    <div
      ref={scroller}
      role="group"
      aria-label="Filtros ativos"
      className="scrollbar-subtle min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
      style={{ maskImage: `linear-gradient(to right, ${fadeLeft}, ${fadeRight})` }}
    >
      <div className="flex w-max min-w-full items-center gap-1.5 pb-1">
        {active.map((field) => (
          <ActiveChip key={field.id} field={field} />
        ))}
      </div>
    </div>
  );
}
