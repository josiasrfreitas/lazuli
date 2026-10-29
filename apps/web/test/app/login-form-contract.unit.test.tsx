import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LoginForm, type LoginMode } from "../../src/app/login/login-form";

function render(mode: LoginMode, pending = false): string {
  return renderToStaticMarkup(
    <LoginForm
      mode={mode}
      pending={pending}
      email=""
      setEmail={() => {}}
      onSubmit={() => {}}
      onModeChange={() => {}}
    />,
  );
}

void test("password login exposes one submit action, accessible fields and password-manager hints", () => {
  const html = render("password");
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  assert.match(html, /name="email"/);
  assert.match(html, /autoComplete="username"/i);
  assert.match(html, /name="password"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="current-password"/i);
  assert.match(html, /for="login-password"/);
  assert.match(html, /aria-label="Mostrar senha"/);
  assert.match(html, /Criar ou recuperar senha/);
  assert.match(html, /Entrar por link no email/);
});

void test("recovery and magic link never require a password", () => {
  for (const mode of ["recover", "magic-link"] as const) {
    const html = render(mode);
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /name="password"/);
    assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
    assert.match(html, /Voltar para o login/);
  }
});

void test("new passwords carry creation hints, limits and disable all controls while saving", () => {
  const html = render("reset", true);
  assert.doesNotMatch(html, /name="email"/);
  assert.match(html, /autoComplete="new-password"/i);
  assert.match(html, /minLength="8"/i);
  assert.match(html, /maxLength="128"/i);
  assert.match(html, /aria-describedby="password-help"/);
  assert.match(html, /Salvar nova senha/);
  for (const control of html.match(/<(?:input|button)\b[^>]*>/g) ?? [])
    assert.match(control, /disabled=""/);
});
