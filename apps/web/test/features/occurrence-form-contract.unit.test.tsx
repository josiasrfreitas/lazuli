import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OutsideOccurrenceFields } from "../../src/features/pedagogical-follow-up/occurrence-outside-fields";
void test("outside-class entry exposes date, time, title, description and optional immediate response with accessible errors", () => {
  const html = renderToStaticMarkup(
    <OutsideOccurrenceFields
      model={{
        outside: true,
        view: "day",
        setOutside: () => {},
        setView: () => {},
        change: () => {},
        save: { isPending: false, error: null, mutate: () => {}, reset: () => {} },
        values: {
          occurredOn: "",
          occurredTime: "",
          account: "",
          title: "",
          category: "OTHER",
          classSessionId: "",
          studentId: "",
          initialResponse: "",
        },
        validation: {
          errors: { occurredTime: "Informe o horário." },
          body: { current: null },
          validate: () => null,
          clear: () => {},
          validateFields: () => false,
        },
      }}
    />,
  );
  assert.equal((html.match(/<(input|textarea)\b/g) ?? []).length, 5);
  for (const name of ["occurredOn", "occurredTime", "title", "account", "initialResponse"]) {
    assert.equal(html.includes(`name="${name}"`), true);
    assert.equal(html.includes(`for="${name}"`), true);
  }
  assert.equal((html.match(/autoComplete="off"/gi) ?? []).length, 5);
  assert.equal((html.match(/placeholder="[^"]+"/g) ?? []).length, 5);
  assert.doesNotMatch(html, /type="date"/);
  assert.match(html, /Informe o horário\./);
  assert.match(html, /Fora de Aula/);
});
