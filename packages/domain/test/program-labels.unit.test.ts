import assert from "node:assert/strict";
import { it } from "node:test";
import { programActivityLabels } from "../src/program-labels.js";
const lesson = (id: string, sequence: number, number: number) => ({
  id,
  sequence,
  kind: "LESSON",
  title: `Lição ${number}`,
  lessons: [{ lesson: { sequence: number }, part: "A" }],
});
const activity = (id: string, sequence: number, title = "Vídeo") => ({
  id,
  sequence,
  kind: "VIDEO",
  title,
  lessons: [],
});
void it("labels intermediate activities by adjacent canonical lessons, including boundaries", () => {
  const labels = programActivityLabels([
    activity("intro", 1, "Atividade da programação"),
    lesson("a", 2, 4),
    activity("v", 3),
    lesson("b", 4, 5),
    activity("r", 5, "Revisão"),
  ]);
  assert.equal(labels.get("intro"), "Atividade da programação · antes da lição 4");
  assert.equal(labels.get("v"), "Vídeo · entre as lições 4 e 5");
  assert.equal(labels.get("r"), "Revisão · após a lição 5");
  assert.equal(labels.get("a"), "Lição 4");
});
void it("does not invent lesson context without relationships", () => {
  assert.equal(programActivityLabels([activity("x", 1)]).get("x"), "Vídeo");
  assert.equal(
    programActivityLabels([lesson("a", 1, 2), activity("v", 2), lesson("b", 3, 2)]).get("v"),
    "Vídeo · durante a lição 2",
  );
});
void it("keeps explicit lesson relationships visible for videos", () => {
  const video = { ...activity("video", 1), lessons: [{ lesson: { sequence: 4 } }] };
  assert.equal(programActivityLabels([video]).get("video"), "Vídeo · lição 4");
});
