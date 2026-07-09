import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toWhatsAppUrl } from "../src/whatsapp-url.js";

void describe("toWhatsAppUrl", () => {
  void it("returns null for missing phones", () => {
    assert.equal(toWhatsAppUrl(null), null);
  });

  void it("returns null when the phone has no digits", () => {
    assert.equal(toWhatsAppUrl("()- "), null);
  });

  void it("strips formatting and prefixes the Brazil country code", () => {
    assert.equal(toWhatsAppUrl("(11) 91234-5678"), "https://wa.me/5511912345678");
  });

  void it("keeps an existing Brazil country code", () => {
    assert.equal(toWhatsAppUrl("+55 11 91234-5678"), "https://wa.me/5511912345678");
  });
});
