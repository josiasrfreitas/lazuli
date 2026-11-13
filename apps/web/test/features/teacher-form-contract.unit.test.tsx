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
void test("employment fields expose masked vacation dates, weekly workload and inline errors", () => {
  const html = renderToStaticMarkup(
    <TeacherEmploymentFields
      draft={draft}
      errors={{ vacationEnd: "Informe o fim das férias." }}
      change={() => {}}
    />,
  );
  for (const name of ["weeklyHours", "vacationStart", "vacationEnd", "notes"])
    assert.match(html, new RegExp(`name="${name}"`));
  assert.equal((html.match(/autoComplete="off"/gi) ?? []).length, 4);
  assert.equal((html.match(/placeholder="[^"]+"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /type="date"|role="combobox"/);
  assert.match(html, /Informe o fim das férias/);
  assert.match(html, /Horas-aula por semana/);
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
