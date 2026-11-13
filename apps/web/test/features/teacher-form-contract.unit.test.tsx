import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TeacherEmploymentFields } from "../../src/features/teachers/teacher-employment-fields";
const draft = {
  name: "",
  email: "",
  cpf: "",
  phone: "",
  isEnabled: false,
  employmentType: "CLT" as const,
  weeklyHours: "",
  notes: "",
  vacationStart: "",
  vacationEnd: "",
};
void test("employment fields expose vacation dates and notes while workload is derived from classes", () => {
  const html = renderToStaticMarkup(
    <TeacherEmploymentFields
      draft={draft}
      errors={{ vacationEnd: "Informe o fim das férias." }}
      change={() => {}}
    />,
  );
  for (const name of ["vacationStart", "vacationEnd", "notes"])
    assert.match(html, new RegExp(`name="${name}"`));
  assert.equal((html.match(/autoComplete="off"/gi) ?? []).length, 3);
  assert.equal((html.match(/placeholder="[^"]+"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /type="date"|role="combobox"/);
  assert.match(html, /Informe o fim das férias/);
  assert.doesNotMatch(html, /name="weeklyHours"/);
});
void test("non CLT registration omits vacation controls", () => {
  const html = renderToStaticMarkup(
    <TeacherEmploymentFields
      draft={{ ...draft, employmentType: "PJ" }}
      errors={{}}
      change={() => {}}
    />,
  );
  assert.doesNotMatch(html, /name="vacationStart"|name="vacationEnd"/);
});
