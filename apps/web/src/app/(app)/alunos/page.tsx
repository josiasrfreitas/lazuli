"use client";

import type { ReactNode } from "react";

import { trpc } from "~/lib/trpc";

/**
 * Placeholder that proves the wiring end to end: providers → tRPC client →
 * `/api/trpc` → `students.list`. The data table composition replaces it.
 */
export default function StudentsPage(): ReactNode {
  const students = trpc.students.list.useQuery({});

  return (
    <div className="p-6">
      <h1 className="font-display text-h2 font-semibold">Alunos</h1>
      <pre className="mt-4 overflow-x-auto text-xs">{renderState(students)}</pre>
    </div>
  );
}

type QueryState = ReturnType<typeof trpc.students.list.useQuery>;

function renderState(students: QueryState): string {
  if (students.isPending) {
    return "Carregando…";
  }

  if (students.error !== null) {
    return students.error.message;
  }

  return JSON.stringify(students.data, null, 2);
}
