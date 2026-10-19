import assert from "node:assert/strict";
import { it } from "node:test";
import {
  applyWorkshopAction,
  initialWorkshopState,
  type Draft,
} from "../../src/features/students/follow-up-workshop/model.js";
const draft: Draft = {
  title: "Revisão da escrita",
  body: "Produziu o texto sem consultar o modelo.",
  nextStep: "Observar a próxima produção.",
  due: "21/10/2026",
  teacher: "Rafael Lima",
  occurrenceIds: ["oral-lesson"],
  lesson: "12/10/2026 · Connect 1",
  category: "Aprendizagem",
  response: "Retomamos as instruções.",
};
void it("keeps the observed outcome and prior history when a concluded case is reopened", () => {
  const original = initialWorkshopState();
  const concluded = applyWorkshopAction(original, {
    kind: "conclude",
    id: "writing",
    draft: draft,
    newId: "unused",
  });
  const reopened = applyWorkshopAction(concluded, {
    kind: "reopen",
    id: "writing",
    draft: { ...draft, body: "Dificuldade voltou a aparecer." },
    newId: "unused",
  });
  const row = reopened.cases.find((item) => item.id === "writing");
  assert.equal(row?.status, "OPEN");
  assert.equal(row?.nextStep, "Observar a próxima produção.");
  assert.deepEqual(
    row?.history.slice(0, 2).map((entry) => entry.body),
    ["Dificuldade voltou a aparecer.", "Produziu o texto sem consultar o modelo."],
  );
  assert.deepEqual(row?.history.slice(2), original.cases[0]?.history);
  assert.equal(original.cases[0]?.status, "IN_PROGRESS");
});
void it("preserves the original occurrence when adding a correction", () => {
  const original = initialWorkshopState();
  const updated = applyWorkshopAction(original, {
    kind: "complement",
    id: "writing-lesson",
    draft: draft,
    newId: "unused",
  });
  assert.equal(
    updated.occurrences[0]?.body,
    "Na atividade de escrita, aguardou o modelo no quadro antes de começar. Com apoio individual, conseguiu organizar as primeiras frases.",
  );
  assert.equal(updated.occurrences[0]?.notes[0]?.body, "Produziu o texto sem consultar o modelo.");
  assert.deepEqual(updated.cases, original.cases);
});
void it("opens an intervention from selected occurrences with an explicit next step", () => {
  const updated = applyWorkshopAction(initialWorkshopState(), {
    kind: "create",
    id: "",
    draft: draft,
    newId: "new-case",
  });
  assert.deepEqual(updated.cases[0], {
    id: "new-case",
    title: "Revisão da escrita",
    objective: "Produziu o texto sem consultar o modelo.",
    nextStep: "Observar a próxima produção.",
    teacher: "Rafael Lima",
    due: "21/10/2026",
    status: "OPEN",
    occurrenceIds: ["oral-lesson"],
    history: [
      {
        title: "Abrir intervenção",
        body: "Produziu o texto sem consultar o modelo.",
        date: "Agora · Você",
      },
    ],
  });
});
