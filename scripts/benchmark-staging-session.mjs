import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";

const STAGING_ORIGIN = "https://staging.lazuli.fisklagarto.com.br";
const linkFile = process.argv[2];
assert(linkFile, "Usage: node scripts/benchmark-staging-session.mjs MAGIC_LINK_FILE");
const link = readFileSync(linkFile, "utf8").trim();
assert.equal(new URL(link).origin, STAGING_ORIGIN, "Expected a Lazuli staging magic link");

const stateFile =
  process.env.LAZULI_PERF_STORAGE_STATE ??
  join(homedir(), ".cache", "lazuli", "staging-benchmark-session.json");
mkdirSync(dirname(stateFile), { recursive: true, mode: 0o700 });
const browser = await chromium.launch({
  executablePath:
    process.env.LAZULI_PERF_CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page
      .locator('section[aria-label="Indicadores da escola"]:not([aria-busy="true"])')
      .waitFor({ timeout: 30000 });
    await context.storageState({ path: stateFile });
    chmodSync(stateFile, 0o600);
    console.log(`Staging benchmark session saved to ${stateFile}`);
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
