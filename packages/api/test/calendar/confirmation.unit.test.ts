import assert from "node:assert/strict";
import { it } from "node:test";
import { calendarConfirmationPhrase, requireCalendarConfirmation } from "../../src/calendar/confirmation.js";

void it("requires written acknowledgement of the actual cancellation count", () => {
  const phrase = calendarConfirmationPhrase(72);
  assert.equal(phrase, "CONFIRMO O CANCELAMENTO DE 72 ATIVIDADES");
  assert.throws(() => requireCalendarConfirmation(phrase), /Digite a confirmação/u);
  assert.throws(() => requireCalendarConfirmation(phrase, "CONFIRMO O CANCELAMENTO DE 71 ATIVIDADES"), /Digite a confirmação/u);
  assert.doesNotThrow(() => requireCalendarConfirmation(phrase, " confirmo o cancelamento de 72 atividades "));
});

void it("does not require a cancellation acknowledgement when nothing will be cancelled", () => {
  assert.equal(calendarConfirmationPhrase(0), null);
  assert.doesNotThrow(() => requireCalendarConfirmation(null));
  assert.equal(calendarConfirmationPhrase(1), "CONFIRMO O CANCELAMENTO DE 1 ATIVIDADE");
});
