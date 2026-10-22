import assert from "node:assert/strict";
import { test } from "node:test";
import { generationCopy } from "../../src/features/class-records/generation-notice.js";

type Row = Parameters<typeof generationCopy>[0];
const base = {
  classId: "class-1",
  className: "Turma A",
  sessionCount: 0,
  pending: false,
  stale: false,
  canGenerate: true,
  request: null,
} as Row;

void test("describes ready, delayed, pending and failed lesson preparation with the right action", () => {
  const cases = [
    {
      name: "unprepared",
      row: base,
      title: "Aulas ainda não preparadas",
      action: "Preparar aulas",
      description:
        "A turma está salva. Tente preparar os encontros para disponibilizá-los na agenda.",
    },
    {
      name: "pending",
      row: { ...base, pending: true },
      title: "Preparando as aulas",
      action: "Preparar aulas",
      description:
        "Os horários da turma e os dias letivos estão sendo organizados. A agenda será atualizada automaticamente.",
    },
    {
      name: "delayed",
      row: { ...base, pending: true, stale: true },
      title: "A preparação está demorando",
      action: "Tentar novamente",
      description: "Você pode tentar novamente. Os encontros existentes serão preservados.",
    },
    {
      name: "failed",
      row: { ...base, request: { status: "FAILED" } as NonNullable<Row["request"]> },
      title: "A preparação das aulas precisa ser retomada",
      action: "Tentar novamente",
      description:
        "A turma está salva. Tente preparar os encontros para disponibilizá-los na agenda.",
    },
    {
      name: "ready",
      row: {
        ...base,
        sessionCount: 2,
        request: { status: "SUCCEEDED" } as NonNullable<Row["request"]>,
      },
      title: "2 encontros preparados",
      action: "Atualizar encontros",
      description: "Os encontros estão disponíveis na agenda da turma.",
    },
    {
      name: "ready without school days",
      row: { ...base, request: { status: "SUCCEEDED" } as NonNullable<Row["request"]> },
      title: "Nenhum dia letivo compatível",
      action: "Atualizar encontros",
      description: "Confira os horários da turma, o período do semestre e os dias de fechamento.",
    },
  ];
  assert.deepEqual(
    cases.map(({ name, row }) => ({ name, ...generationCopy(row) })),
    cases.map(({ name, title, description, action }) => ({ name, title, description, action })),
  );
});
