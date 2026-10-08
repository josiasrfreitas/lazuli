import assert from "node:assert/strict";
import test from "node:test";

import { classFilterFields } from "../../src/features/classes/class-filter-fields.js";
import {
  classListQueryInput,
  classListReturnUrl,
  CLEAR_CLASS_FILTERS,
  type ClassListParams,
} from "../../src/features/classes/class-list-model.js";

const teacherId = "11111111-1111-4111-8111-111111111111";
const semesterId = "22222222-2222-4222-8222-222222222222";
const stageId = "33333333-3333-4333-8333-333333333333";
const params: ClassListParams = {
  busca: "Turma de terça",
  tipo: "REGULAR,PERSONALIZED,REGULAR,invalid",
  formato: "ONLINE",
  professor: `${teacherId},invalid,${teacherId}`,
  estagio: `${stageId},invalid,${stageId}`,
  semestre: semesterId,
  estado: "ACTIVE,ARCHIVED",
  pagina: 3,
};

void test("class filter URLs preserve multiple selections and reject invalid values", () => {
  assert.deepEqual(classListQueryInput(params), {
    search: "Turma de terça",
    page: 3,
    pageSize: 20,
    scheduleTypes: ["REGULAR", "PERSONALIZED"],
    formats: ["ONLINE"],
    teacherIds: [teacherId],
    stageIds: [stageId],
    semesterIds: [semesterId],
    statuses: ["ACTIVE", "ARCHIVED"],
  });
  const back = new URL(classListReturnUrl(params), "https://lazuli.example");
  assert.equal(back.pathname, "/turmas");
  assert.equal(back.searchParams.get("busca"), "Turma de terça");
  assert.equal(back.searchParams.get("tipo"), params.tipo);
  assert.equal(back.searchParams.get("estagio"), params.estagio);
  assert.equal(back.searchParams.get("pagina"), "3");
});

void test("changing and clearing class filters resets pagination without losing search or other selections", () => {
  let current = params;
  const fields = classFilterFields({
    params: current,
    options: undefined,
    change: (patch) => {
      current = { ...current, ...patch };
    },
  });
  const organization = fields.find((field) => field.id === "tipo");
  assert.ok(organization);
  assert.equal(organization.kind, "options");
  organization.onChange(["PERSONALIZED"]);
  assert.deepEqual({ ...current }, { ...params, tipo: "PERSONALIZED", pagina: 1 });
  organization.onClear();
  assert.deepEqual({ ...current }, { ...params, tipo: null, pagina: 1 });
  const stage = fields.find((field) => field.id === "estagio");
  assert.ok(stage);
  assert.equal(stage.label, "Estágio");
  assert.notEqual(stage.promoted, true);
  stage.onClear();
  assert.equal(current.estagio, null);
  stage.onChange([stageId]);
  assert.equal(current.estagio, stageId);
  assert.equal(current.pagina, 1);
  assert.deepEqual(classListQueryInput({ ...current, ...CLEAR_CLASS_FILTERS }), {
    search: "Turma de terça",
    page: 1,
    pageSize: 20,
    scheduleTypes: [],
    formats: [],
    teacherIds: [],
    stageIds: [],
    semesterIds: [],
    statuses: [],
  });
});
