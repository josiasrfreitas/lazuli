import assert from "node:assert/strict";
import { test } from "node:test";

import { createMagicLinkEmail } from "../src/magic-link-email.js";

void test("the branded access email has one action and a plain-text alternative", () => {
  const url = "https://school.example/api/auth/magic-link/verify?token=example&callbackURL=%2F";
  const { html, text } = createMagicLinkEmail(url);
  assert.match(html ?? "", /lang="pt-BR"/u);
  assert.match(html ?? "", /LAZULI/u);
  assert.match(html ?? "", /Entrar na Lazuli/u);
  assert.equal((html?.match(/<a /gu) ?? []).length, 1);
  assert.match(
    html ?? "",
    /href="https:\/\/school.example\/api\/auth\/magic-link\/verify\?token=example&amp;callbackURL=%2F"/u,
  );
  assert.equal(
    text,
    `Seu acesso à Lazuli\n\nEntre pelo link abaixo:\n${url}\n\nSe você não pediu este link, pode ignorar este email.`,
  );
});

void test("URL characters cannot escape the email link attribute", () => {
  const url = "https://school.example/verify?token=\"<example>\"&value='quoted'";
  const { html, text } = createMagicLinkEmail(url);
  assert.match(html ?? "", /token=&quot;&lt;example&gt;&quot;&amp;value=&#39;quoted&#39;/u);
  assert.doesNotMatch(html ?? "", /<example>/u);
  assert.equal(text?.includes(url), true);
});
