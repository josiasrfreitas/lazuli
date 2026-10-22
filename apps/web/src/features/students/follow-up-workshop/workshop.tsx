"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@lazuli/ui";
import { StudentPage } from "../profile/student-page";
import { LayoutWorkshop, LAYOUTS, type LayoutDirection } from "./layout-workshop";
import type { AppointmentScenario } from "./appointment-preview";

const SCENARIOS = [
  { id: "empty", label: "Nenhum" },
  { id: "one", label: "Um" },
  { id: "few", label: "Poucos" },
  { id: "several", label: "Vários" },
] as const;

export function FollowUpWorkshop(): ReactElement {
  const [direction, setDirection] = useState<LayoutDirection>("strip");
  const [scenario, setScenario] = useState<AppointmentScenario>("one");
  const studentId = useSearchParams().get("aluno");
  if (!studentId)
    return (
      <div className="grid gap-4 p-6">
        <h1 className="text-xl font-semibold">Workshop de acompanhamento</h1>
        <p>Abra o workshop com o aluno que deseja visualizar.</p>
        <Link href="/alunos">Escolher aluno</Link>
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkshopControls
        direction={direction}
        setDirection={setDirection}
        scenario={scenario}
        setScenario={setScenario}
      />
      <StudentPage
        id={studentId}
        pedagogyWorkspacePreview={
          <LayoutWorkshop direction={direction} scenario={scenario} studentId={studentId} />
        }
      />
    </div>
  );
}

function WorkshopControls({
  direction,
  setDirection,
  scenario,
  setScenario,
}: {
  direction: LayoutDirection;
  setDirection: (value: LayoutDirection) => void;
  scenario: AppointmentScenario;
  setScenario: (value: AppointmentScenario) => void;
}): ReactElement {
  return (
    <header className="grid shrink-0 gap-3 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="text-sm">Mesa de acompanhamento + atendimentos</strong>
          <p className="text-xs text-muted-foreground">
            Workshop de layout · registros e atendimentos fictícios
          </p>
        </div>
        <LayoutChoices direction={direction} setDirection={setDirection} />
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Quantidade de atendimentos no exemplo"
      >
        <span className="text-xs text-muted-foreground">Atendimentos no exemplo:</span>
        {SCENARIOS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={scenario === option.id ? "secondary" : "ghost"}
            aria-pressed={scenario === option.id}
            onClick={() => setScenario(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </header>
  );
}

function LayoutChoices({
  direction,
  setDirection,
}: {
  direction: LayoutDirection;
  setDirection: (value: LayoutDirection) => void;
}): ReactElement {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Disposição da mesa e dos atendimentos"
    >
      {LAYOUTS.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={direction === option.id ? "primary" : "secondary"}
          aria-pressed={direction === option.id}
          onClick={() => setDirection(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
