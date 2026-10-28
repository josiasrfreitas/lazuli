import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RenegotiationFields } from "../../src/features/students/profile/contract-renegotiation-fields";

void test("the renegotiation form identifies its currency field, reason, and user-selected installments", () => {
  const html = renderToStaticMarkup(
    <RenegotiationFields
      options={{
        contractId: "contract",
        studentId: "student",
        studentName: "Aluno",
        today: "2026-10-27",
        lines: [],
        history: [],
      }}
      ids={[]}
      amount={null}
      reason=""
      errors={{}}
      onIds={() => {}}
      onAmount={() => {}}
      onReason={() => {}}
    />,
  );
  assert.match(html, /name="newAmountCents"/);
  assert.match(html, /name="reason"/);
  assert.match(html, /placeholder="R\$ 0,00"/);
  assert.match(html, /autoComplete="off"/i);
  assert.match(html, /Parcelas para renegociar/);
  assert.doesNotMatch(html, /type="date"|role="combobox"/);
});
