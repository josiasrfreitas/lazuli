import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { Dialog } from "@lazuli/ui";
import { EditorFormBody } from "../../src/features/stage-catalog/editor-form.js";
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
  lessons: [
    {
      id: "lesson",
      sequence: 1,
      title: "Lição 1",
      pages: [
        {
          id: "page",
          number: 18,
          activities: [{ id: "book-activity", sequence: 1, title: "Exercício 1" }],
        },
      ],
      parts: [
        {
          id: "part",
          sequence: 1,
          title: "Parte A",
          pages: [
            {
              id: "page",
              number: 18,
              activities: [{ id: "book-activity", sequence: 1, title: "Exercício 1" }],
            },
          ],
        },
      ],
    },
  ],
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
      lessons: [
        {
          id: "lesson",
          sequence: 1,
          title: "Lição 1",
          part: "Seção livre",
          bookPart: null,
          bookPage: null,
          pageActivity: null,
        },
      ],
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
function renderFields(children: ReactNode): string {
  return renderToStaticMarkup(
    <Dialog open>
      <EditorFormBody
        title="Cadastro"
        onClose={() => {}}
        onSave={async () => {}}
        form={{ current: null }}
        pending={{ current: false }}
      >
        {children}
      </EditorFormBody>
    </Dialog>,
  );
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
    [{ action: "part", stageId: stage.id, lessonId: "lesson", context: "Lição 1" }, ["title"]],
    [
      { action: "page", stageId: stage.id, lessonId: "lesson", partId: "part", context: "Parte A" },
      ["number"],
    ],
    [
      {
        action: "pageActivity",
        stageId: stage.id,
        lessonId: "lesson",
        partId: "part",
        pageId: "page",
        context: "Página 18",
      },
      ["title"],
    ],
    [{ action: "legacy", target: "track", id: "track", name: "Track" }, []],
  ];
  for (const [item, names] of cases) {
    const html = renderFields(<CatalogFields item={item} />);
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
    assertControls(renderFields(<ProgramFields item={item} stage={stage} />), names);
  }
});
void it("edits existing book pages or an insertion at the chosen position with all neighboring minutes visible", () => {
  for (const editing of [true, false]) {
    const html = renderWithQueries(
      <Dialog open>
        <ActivityForm
          stage={stage}
          programId="program"
          hour={hour}
          position={editing ? 0 : 1}
          editing={editing}
          onSaved={() => {}}
          pending={{ current: false }}
          form={{ current: null }}
          description="Unidade 1 · Hora-aula 01"
          close={() => {}}
        />
      </Dialog>,
    );
    assertControls(html, [
      "minutes",
      "pageStart",
      "pageEnd",
      ...(editing ? [] : ["minutes-activity"]),
    ]);
    assert.match(html, /Texto livre/);
    assert.doesNotMatch(html, /Tipo de atividade|Trechos do livro/);
    if (editing) assert.match(html, /Exercício 1/);
  }
});
void it("opens free-text activities without requiring a book page", () => {
  const item = { ...hour.activities[0]!, pageStart: null, pageEnd: null };
  const html = renderWithQueries(
    <Dialog open>
      <ActivityForm
        stage={stage}
        programId="program"
        hour={{ ...hour, activities: [item] }}
        position={0}
        editing
        onSaved={() => {}}
        description="Hora"
        form={{ current: null }}
        pending={{ current: false }}
        close={() => {}}
      />
    </Dialog>,
  );
  assertControls(html, ["title", "minutes"]);
  assert.doesNotMatch(html, /name="pageStart"/);
});

void it("groups consecutive pages under one lesson and reopens the activity title", () => {
  const lesson = stage.lessons[0]!;
  const pages = Array.from({ length: 5 }, (_, i) => ({
    ...lesson.pages[0]!,
    id: "p" + i,
    number: i + 1,
    activities: i === 0 ? lesson.pages[0]!.activities : [],
  }));
  const html = renderWithQueries(
    <Dialog open>
      <ActivityForm
        stage={{ ...stage, lessons: [{ ...lesson, pages }] }}
        programId="program"
        hour={{
          ...hour,
          activities: [
            { ...hour.activities[0]!, pageStart: 1, pageEnd: 5, bookTitle: "Prática oral" },
          ],
        }}
        position={0}
        editing
        onSaved={() => {}}
        description="Hora"
        form={{ current: null }}
        pending={{ current: false }}
        close={() => {}}
      />
    </Dialog>,
  );
  const text = html.replace(/<[^>]*>/g, "");
  assert.match(text, /Lição 1 · Págs. 1–5/);
  assert.match(text, /Pág. 1 · Exercício 1/);
  assert.doesNotMatch(text, /Pág. 2/);
  assert.match(html, /value="Prática oral"/);
});
