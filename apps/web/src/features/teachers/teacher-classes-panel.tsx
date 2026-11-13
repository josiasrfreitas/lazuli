"use client";
import { useId, type ReactElement } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, BookOpen, CalendarDays, X } from "lucide-react";
import { parseAsBoolean, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
import { Button, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { TeacherDatedAgenda } from "./teacher-dated-agenda";
import { TeacherClassMetrics } from "./teacher-class-metrics";
import {
  CLASS_DIRECTIONS,
  CLASS_ORDERS,
  CLASS_ORDER_OPTIONS,
  CLASS_TYPES,
  CLASS_TYPE_OPTIONS,
  defaultClassDirection,
} from "./teacher-class-order";
import styles from "./teacher-class-metrics.module.css";

const VIEWS = ["turmas", "agenda"] as const;
export function TeacherClassesPanel({ id, back }: { id: string; back: string }): ReactElement {
  const [view, setView] = useQueryState(
    "visao-turmas",
    parseAsStringLiteral(VIEWS).withDefault("turmas"),
  );
  const [sorting, setSorting] = useQueryStates({
    "ordem-turmas": parseAsStringLiteral(CLASS_ORDERS).withDefault("score"),
    "direcao-turmas": parseAsStringLiteral(CLASS_DIRECTIONS),
  });
  const order = sorting["ordem-turmas"];
  const direction = sorting["direcao-turmas"] ?? defaultClassDirection(order);
  const [filters, setFilters] = useQueryStates({
    "tipo-turmas": parseAsStringLiteral(CLASS_TYPES),
    "atencao-turmas": parseAsBoolean.withDefault(false),
  });
  const classFilters = { type: filters["tipo-turmas"], attention: filters["atencao-turmas"] };
  const clearFilters = (): void => {
    void setFilters({ "tipo-turmas": null, "atencao-turmas": false });
  };
  const panelId = useId();
  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <SegmentedControl
          size="sm"
          aria-label="Visualização das turmas do professor"
          value={view}
          onValueChange={(value) => {
            const next = VIEWS.find((item) => item === value);
            if (next) void setView(next);
          }}
        >
          <SegmentedControlItem value="turmas" aria-controls={panelId}>
            <span className={styles.switchLabel}>
              <BookOpen aria-hidden="true" />
              Turmas
            </span>
          </SegmentedControlItem>
          <SegmentedControlItem value="agenda" aria-controls={panelId}>
            <span className={styles.switchLabel}>
              <CalendarDays aria-hidden="true" />
              Agenda
            </span>
          </SegmentedControlItem>
        </SegmentedControl>
        {view === "turmas" && (
          <div className={styles.order} role="group" aria-label="Filtrar turmas">
            {CLASS_TYPE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={classFilters.type === option.value ? "primary" : "secondary"}
                aria-pressed={classFilters.type === option.value}
                onClick={() =>
                  void setFilters({
                    "tipo-turmas": classFilters.type === option.value ? null : option.value,
                  })
                }
              >
                {option.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={classFilters.attention ? "primary" : "secondary"}
              aria-pressed={classFilters.attention}
              aria-label="Turmas com alunos em atenção ou prioridade"
              title="Turmas com alunos em atenção ou prioridade. Pode combinar com Regular ou PPT."
              onClick={() => void setFilters({ "atencao-turmas": !classFilters.attention })}
            >
              Em atenção
            </Button>
            {(classFilters.type || classFilters.attention) && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Limpar filtros"
                title="Limpar filtros"
                onClick={clearFilters}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        {view === "turmas" && (
          <div className={styles.order} role="group" aria-label="Ordenar turmas">
            {CLASS_ORDER_OPTIONS.map((option) => {
              const active = order === option.value;
              const next = active
                ? direction === "asc"
                  ? "desc"
                  : "asc"
                : defaultClassDirection(option.value);
              const directionLabel = direction === "asc" ? "crescente" : "decrescente";
              return (
                <Button
                  key={option.value}
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  aria-pressed={active}
                  aria-label={
                    active
                      ? `${option.label}, ordem ${directionLabel}. Inverter ordem`
                      : `Ordenar por ${option.label.toLowerCase()}`
                  }
                  title={
                    active
                      ? `Ordem ${directionLabel}. Clique para inverter`
                      : `Ordenar por ${option.label.toLowerCase()}`
                  }
                  onClick={() =>
                    void setSorting({ "ordem-turmas": option.value, "direcao-turmas": next })
                  }
                >
                  {option.label}
                  {active ? (
                    direction === "asc" ? (
                      <ArrowUp aria-hidden="true" />
                    ) : (
                      <ArrowDown aria-hidden="true" />
                    )
                  ) : (
                    <ArrowDownUp aria-hidden="true" />
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      <div id={panelId} key={view} className={styles.view}>
        {view === "turmas" ? (
          <TeacherClassMetrics
            id={id}
            back={back}
            order={order}
            direction={direction}
            filters={classFilters}
            onClearFilters={clearFilters}
          />
        ) : (
          <TeacherDatedAgenda id={id} back={back} />
        )}
      </div>
    </div>
  );
}
