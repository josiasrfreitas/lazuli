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
  area: "SECRETARIAT" as const,
  jobTitle: "Auxiliar",
  role: "SECRETARY" as const,
  teaches: true,
  notes: "",
};
void test("employment fields collect role-independent employment information and omit legacy dates", () => {
  const html = renderToStaticMarkup(
    <TeacherEmploymentFields draft={draft} errors={{}} change={() => {}} />,
  );
  for (const name of ["area", "jobTitle", "teaches", "notes"])
    assert.match(html, new RegExp(`name="${name}"`));
  assert.doesNotMatch(html, /vacationStart|vacationEnd|weeklyHours/);
});
void test("non-teaching employees do not receive teaching notes", () => {
  const html = renderToStaticMarkup(
    <TeacherEmploymentFields draft={{ ...draft, teaches: false }} errors={{}} change={() => {}} />,
  );
  assert.doesNotMatch(html, /name="notes"/);
});
