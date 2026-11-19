import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorForm } from "../../src/features/stage-catalog/editor-form.js";
import {
  CatalogFields,
  type CatalogDialogState,
} from "../../src/features/stage-catalog/catalog-dialog.js";
import {
  ProgramFields,
  type ProgramDialogState,
} from "../../src/features/stage-catalog/program-dialog.js";
import { ActivityForm } from "../../src/features/stage-catalog/activity-form.js";
import type { StageDetail, TeachingHour } from "../../src/features/stage-catalog/types.js";
import { renderWithQueries } from "../support/query-render.js";

const stage: StageDetail = {
  id: "stage",
  name: "Livro",
  internalCode: "L1",
  status: "ACTIVE",
  track: { id: "track", name: "Track", status: "ACTIVE", ageGroup: "ADULT" },
  lessonCount: 1,
  lessons: [{ id: "lesson", sequence: 1, title: "Lição 1" }],
  programs: [],
};
const hour: TeachingHour = {
  id: "hour",
  sequence: 1,
  durationMinutes: 60,
  unitMinutes: 60,
  lastChange: "2026-11-19",
  activities: [
    {
      id: "activity",
      kind: "LESSON",
      title: "Leitura",
      bookTitle: "Leitura",
      sourceCode: null,
      descriptionPending: false,
      durationMinutes: 60,
      lessons: [{ ...stage.lessons[0]!, part: null }],
      pageStart: 18,
      pageEnd: 21,
      assessment: null,
    },
  ],
};
const unit = { id: "unit", sequence: 1, title: "Unidade 1", teachingHours: [hour] };

function assertControls(html: string, names: string[]): void {
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.match(html, /noValidate=""/i);
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  for (const name of names) assert.ok(html.includes('name="' + name + '"'));
  for (const input of html.match(/<input\b[^>]*>/g) ?? []) {
    if (input.includes('type="hidden"') || input.includes('aria-hidden="true"')) continue;
    assert.match(input, /placeholder="[^"]+"/);
    assert.match(input, /name="[^"]+"/);
    assert.match(input, /autoComplete="off"/i);
  }
}
void it("labels and submits each catalog operation, including the Legacy confirmation", () => {
  const cases: [CatalogDialogState, string[]][] = [
    [{ action: "createTrack", lines: [{ id: "adult", name: "Adultos" }] }, ["line", "age", "name"]],
    [{ action: "createStage", trackId: "track", trackName: "Track" }, ["name", "code"]],
    [
      { action: "editStage", id: stage.id, name: stage.name, internalCode: stage.internalCode },
      ["name", "code"],
    ],
    [{ action: "lesson", stageId: stage.id }, ["title"]],
    [{ action: "legacy", target: "track", id: "track", name: "Track" }, []],
  ];
  for (const [item, names] of cases) {
    const html = renderToStaticMarkup(
      <EditorForm inline title="Catálogo" onClose={() => {}} onSave={async () => {}}>
        <CatalogFields item={item} />
      </EditorForm>,
    );
    assertControls(html, names);
    if (item.action === "legacy") assert.match(html, /todos os estágios desta track/);
  }
});
void it("offers the required book fields for starting, extending, and naming a program unit", () => {
  const cases: [ProgramDialogState, string[]][] = [
    [{ action: "start" }, ["schedule", "unitTitle", "assessment"]],
    [{ action: "unit", programId: "program" }, ["unitTitle", "assessment"]],
    [{ action: "renameUnit", programId: "program", unit }, ["unitTitle"]],
    [{ action: "hour", programId: "program", unit }, ["title", "lesson"]],
  ];
  for (const [item, names] of cases) {
    assertControls(
      renderToStaticMarkup(
        <EditorForm inline title="Programação" onClose={() => {}} onSave={async () => {}}>
          <ProgramFields item={item} stage={stage} />
        </EditorForm>,
      ),
      names,
    );
  }
});
void it("edits existing book pages or an insertion at the chosen position with all neighboring minutes visible", () => {
  for (const editing of [true, false]) {
    const html = renderWithQueries(
      <ActivityForm
        stage={stage}
        programId="program"
        hour={hour}
        position={editing ? 0 : 1}
        editing={editing}
        close={() => {}}
      />,
    );
    assertControls(html, [
      "title",
      "minutes",
      "pageStart",
      "pageEnd",
      ...(editing ? [] : ["minutes-activity"]),
    ]);
    const page = html.match(/<input[^>]*name="pageStart"[^>]*>/)?.[0] ?? "";
    assert.doesNotMatch(page, /required/);
    if (editing) assert.match(page, /value="18"/);
  }
});
