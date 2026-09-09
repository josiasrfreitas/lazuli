import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EM_DASH,
  formatAttendancePercent,
  formatBRLFromCents,
  formatLongDateSaoPaulo,
  toWhatsAppUrl,
} from "../../src/lib/format.js";
import { getTestEnvironment } from "../support/env.js";

const TUITION_CENTS = 38_000;
const ZERO_CENTS = 0;
const CENTS_WITH_REMAINDER = 1234;
const THREE_QUARTERS = 0.75;
const HALF = 0.5;
const NON_BREAKING_SPACE = /\u00A0/gu;
const SAO_PAULO_DATE_ONLY_HOST_CHECK = fileURLToPath(
  new URL("../support/format-sao-paulo-date-only-host-check.ts", import.meta.url),
);
const UTC_TIME_ZONE = "UTC";
const SAO_PAULO_PREVIOUS_DATE = "2026-06-30";

/** Intl separates "R$" from the amount with a non-breaking space. */
function normalize(value: string): string {
  return value.replaceAll(NON_BREAKING_SPACE, " ");
}

void describe("format", () => {
  void it("renders cents as pt-BR currency", () => {
    assert.equal(normalize(formatBRLFromCents(TUITION_CENTS)), "R$ 380,00");
    assert.equal(normalize(formatBRLFromCents(ZERO_CENTS)), "R$ 0,00");
    assert.equal(normalize(formatBRLFromCents(CENTS_WITH_REMAINDER)), "R$ 12,34");
  });

  void it("renders a long pt-BR date in São Paulo, not in UTC", () => {
    // 00:30 UTC on the 25th is still the 24th in São Paulo (UTC-3).
    const instant = new Date("2026-08-25T00:30:00.000Z");

    assert.equal(formatLongDateSaoPaulo(instant), "segunda-feira, 24 de agosto de 2026");
  });

  void it("uses São Paulo's calendar day when the host timezone is UTC", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", SAO_PAULO_DATE_ONLY_HOST_CHECK],
      {
        encoding: "utf8",
        env: getTestEnvironment({ NODE_ENV: "test", TZ: UTC_TIME_ZONE }),
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, SAO_PAULO_PREVIOUS_DATE);
  });

  void it("renders attendance as a whole percent and missing data as an em dash", () => {
    assert.equal(formatAttendancePercent(THREE_QUARTERS), "75%");
    assert.equal(formatAttendancePercent(HALF), "50%");
    assert.equal(formatAttendancePercent(null), EM_DASH);
  });

  void it("builds wa.me links from Brazilian phone numbers", () => {
    assert.equal(toWhatsAppUrl("(11) 98801-2233"), "https://wa.me/5511988012233");
    assert.equal(toWhatsAppUrl(null), null);
  });
});
