import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { createAuth } from "../src/auth.js";
import { STAFF_ACCESS_DENIED_CODE } from "../src/staff-access.js";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "A sufficiently long test password";
const deliveries: Array<{ email: string; url: string }> = [];
const magicLinks: Array<{ email: string; url: string }> = [];
const ids: string[] = [];
const auth = createAuth({
  database: db,
  environment: {
    appUrl: BASE_URL,
    betterAuthSecret: "test-secret-with-at-least-thirty-two-characters",
    resendApiKey: undefined,
    emailFrom: "Lazuli <no-reply@example.com>",
    smtpHost: "localhost",
    smtpPort: 1025,
  },
  sendResetPassword: (delivery) => {
    deliveries.push(delivery);
    return Promise.resolve();
  },
  sendMagicLink: (delivery) => {
    magicLinks.push(delivery);
    return Promise.resolve();
  },
});

void describe("staff password access", () => {
  void before(async () => {
    await db.$connect();
  });
  void after(async () => {
    await db.verification.deleteMany({ where: { value: { in: ids } } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.account.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  void it("creates a first credential through email ownership and signs in without public signup", async () => {
    const user = await staff();
    const request = await post("/request-password-reset", {
      email: user.email,
      redirectTo: "/cadastrar-senha",
    });
    assert.equal(request.status, 200);
    const token = await deliveredToken(user.email, "/cadastrar-senha");
    const reset = await post("/reset-password", { token, newPassword: PASSWORD });
    assert.deepEqual(await reset.json(), { status: true });
    const account = await db.account.findFirstOrThrow({
      where: { userId: user.id, providerId: "credential" },
    });
    assert.notEqual(account.password, PASSWORD);
    assert.equal(typeof account.password, "string");
    const login = await post("/sign-in/email", { email: user.email, password: PASSWORD });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie") ?? "", /session_token=/);
    assert.equal(await responseUserEmail(login), user.email);
    const session = await auth.getSession({
      headers: new Headers({ cookie: login.headers.get("set-cookie") ?? "" }),
    });
    assert.equal(session?.user.email, user.email);
    const replay = await post("/reset-password", { token, newPassword: "Another long password" });
    assert.equal(replay.status, 400);
    assert.equal(await responseCode(replay), "INVALID_TOKEN");
  });

  void it("revokes existing sessions and replaces the password while retaining magic-link access", async () => {
    const user = await staff();
    await setPassword(user.email);
    await post("/sign-in/email", { email: user.email, password: PASSWORD });
    assert.equal(await db.session.count({ where: { userId: user.id } }), 1);
    await post("/request-password-reset", { email: user.email, redirectTo: "/login?mode=reset" });
    const token = await deliveredToken(user.email);
    const reset = await post("/reset-password", { token, newPassword: "The replacement password" });
    assert.equal(reset.status, 200);
    assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
    const oldLogin = await post("/sign-in/email", { email: user.email, password: PASSWORD });
    assert.equal(oldLogin.status, 401);
    assert.equal(await responseCode(oldLogin), "INVALID_EMAIL_OR_PASSWORD");
    const newLogin = await post("/sign-in/email", {
      email: user.email,
      password: "The replacement password",
    });
    assert.equal(newLogin.status, 200);
    assert.equal(await responseUserEmail(newLogin), user.email);
    await post("/sign-in/magic-link", { email: user.email, callbackURL: "/" });
    const link = magicLinks.find((delivery) => delivery.email === user.email);
    assert.ok(link);
    const verify = await auth.handler(new Request(link.url));
    assert.equal(verify.status, 302);
    assert.match(verify.headers.get("set-cookie") ?? "", /session_token=/);
  });

  void it("keeps recovery indistinguishable for unknown and disabled staff and sends neither email", async () => {
    const user = await staff();
    await db.user.update({ where: { id: user.id }, data: { isEnabled: false } });
    const unknown = await post("/request-password-reset", {
      email: `unknown-${randomUUID()}@example.com`,
    });
    const disabled = await post("/request-password-reset", { email: user.email });
    assert.equal(unknown.status, 200);
    assert.equal(disabled.status, 200);
    assert.deepEqual(await unknown.json(), await disabled.json());
    assert.equal(
      deliveries.some((delivery) => delivery.email === user.email),
      false,
    );
  });

  void it("invalidates a reset link when staff access is revoked after delivery", async () => {
    const user = await staff();
    await post("/request-password-reset", { email: user.email, redirectTo: "/cadastrar-senha" });
    const token = await deliveredToken(user.email, "/cadastrar-senha");
    await db.user.update({ where: { id: user.id }, data: { isEnabled: false } });
    const denied = await post("/reset-password", { token, newPassword: PASSWORD });
    assert.equal(denied.status, 400);
    assert.equal(await responseCode(denied), "INVALID_TOKEN");
    assert.equal(
      await db.account.count({ where: { userId: user.id, providerId: "credential" } }),
      0,
    );
    await db.user.update({ where: { id: user.id }, data: { isEnabled: true } });
    const replay = await post("/reset-password", { token, newPassword: PASSWORD });
    assert.equal(replay.status, 400);
  });

  void it("rechecks staff eligibility when the password is correct", async () => {
    const user = await staff();
    await setPassword(user.email);
    for (const { data, code } of [
      { data: { isEnabled: false }, code: STAFF_ACCESS_DENIED_CODE },
      { data: { isEnabled: true, role: "FINANCE" as const }, code: STAFF_ACCESS_DENIED_CODE },
      {
        data: { role: "ADMIN" as const, deletedAt: new Date() },
        code: "INVALID_EMAIL_OR_PASSWORD",
      },
    ]) {
      await db.user.update({ where: { id: user.id }, data });
      const response = await post("/sign-in/email", { email: user.email, password: PASSWORD });
      assert.equal(response.status, 401);
      assert.equal(await responseCode(response), code, JSON.stringify(data));
      assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
    }
  });

  void it("rejects expired tokens and short passwords without consuming a usable link", async () => {
    const user = await staff();
    await post("/request-password-reset", { email: user.email, redirectTo: "/login?mode=reset" });
    const token = await deliveredToken(user.email);
    const short = await post("/reset-password", { token, newPassword: "short" });
    assert.equal(short.status, 400);
    assert.equal(await responseCode(short), "PASSWORD_TOO_SHORT");
    assert.equal(await db.account.count({ where: { userId: user.id } }), 0);
    await db.verification.updateMany({
      where: { value: user.id },
      data: { expiresAt: new Date(0) },
    });
    const expired = await post("/reset-password", { token, newPassword: PASSWORD });
    assert.equal(expired.status, 400);
    assert.equal(await responseCode(expired), "INVALID_TOKEN");
    assert.equal(await db.account.count({ where: { userId: user.id } }), 0);
  });

  void it("refuses public password signup without creating an identity", async () => {
    const email = `signup-${randomUUID()}@example.com`;
    const response = await post("/sign-up/email", { name: "Uninvited", email, password: PASSWORD });
    assert.equal(response.status, 400);
    assert.equal(await responseCode(response), "EMAIL_PASSWORD_SIGN_UP_DISABLED");
    assert.equal(await db.user.findUnique({ where: { email } }), null);
  });
});

async function staff(): Promise<{ id: string; email: string }> {
  const user = await db.user.create({
    data: {
      name: "Password Test",
      email: `password-${randomUUID()}@example.com`,
      role: "ADMIN",
      isEnabled: true,
    },
  });
  ids.push(user.id);
  return user;
}

function post(path: string, body: Record<string, string>): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  );
}

async function deliveredToken(email: string, pathname = "/login"): Promise<string> {
  const delivery = deliveries.findLast((item) => item.email === email);
  assert.ok(delivery);
  const callback = await auth.handler(new Request(delivery.url));
  assert.equal(callback.status, 302);
  const url = new URL(callback.headers.get("location") ?? "", BASE_URL);
  assert.equal(url.pathname, pathname);
  if (pathname === "/login") assert.equal(url.searchParams.get("mode"), "reset");
  const token = url.searchParams.get("token");
  assert.ok(token);
  return token;
}

async function setPassword(email: string): Promise<void> {
  await post("/request-password-reset", { email, redirectTo: "/login?mode=reset" });
  const reset = await post("/reset-password", {
    token: await deliveredToken(email),
    newPassword: PASSWORD,
  });
  assert.equal(reset.status, 200);
}

function responseBody(response: Response): Promise<{ code?: string; user?: { email: string } }> {
  return response.json() as Promise<{ code?: string; user?: { email: string } }>;
}

async function responseCode(response: Response): Promise<string | undefined> {
  const body = await responseBody(response);
  return body.code;
}

async function responseUserEmail(response: Response): Promise<string | undefined> {
  const body = await responseBody(response);
  return body.user?.email;
}
