import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { THIRTY_DAY_SESSION_SECONDS } from "../../src/auth-options.js";
import { createAuth } from "../../src/auth.js";
import { STAFF_ACCESS_DENIED_CODE } from "../../src/index.js";
import type { AuthEnvironment, AuthInstance, MagicLinkDelivery } from "../../src/index.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const AUTH_FLOW_PREFIX = "auth-flow-";
const HTTP_OK = 200;
const HTTP_FOUND = 302;
const HTTP_UNAUTHORIZED = 401;
const MILLISECONDS_PER_SECOND = 1000;
const SIGN_IN_MAGIC_LINK_PATH = "/api/auth/sign-in/magic-link";
const SIGN_OUT_PATH = "/api/auth/sign-out";

const TEST_AUTH_ENVIRONMENT: AuthEnvironment = {
  appUrl: "http://localhost:3000",
  betterAuthSecret: "test-secret-with-at-least-thirty-two-characters",
  googleClientId: "google-client-id",
  googleClientSecret: "google-client-secret",
  resendApiKey: undefined,
  emailFrom: "Lazuli <no-reply@example.com>",
  smtpHost: "localhost",
  smtpPort: 1025,
};

type AuthFlowContext = {
  auth: AuthInstance;
  createdEmails: string[];
  deliveries: MagicLinkDelivery[];
};

void describe("Better Auth staff flows", () => {
  const context = createAuthFlowContext();

  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanAuthFlowRows(context.createdEmails);
    await db.$disconnect();
  });

  registerEnabledStaffMagicLinkTest(context);
  registerUnknownEmailMagicLinkTest(context);
  registerDisabledStaffMagicLinkTest(context);
  registerMagicLinkSessionTest(context);
  registerDeniedVerificationRedirectTest(context);
  registerSignOutTest(context);
});

function createAuthFlowContext(): AuthFlowContext {
  const deliveries: MagicLinkDelivery[] = [];
  const auth = createAuth({
    environment: TEST_AUTH_ENVIRONMENT,
    database: db,
    sendMagicLink: (delivery) => {
      deliveries.push(delivery);
      return Promise.resolve();
    },
  });

  return { auth, createdEmails: [], deliveries };
}

function registerEnabledStaffMagicLinkTest(context: AuthFlowContext): void {
  databaseIt("sends a magic link to enabled pre-provisioned staff", async () => {
    resetDeliveries(context);
    const email = await createTeacher({ context, name: "Professora Teste" });

    const response = await requestMagicLink(context, email);

    assert.equal(response.status, HTTP_OK);
    assert.equal(context.deliveries.length, 1);
    assert.equal(context.deliveries[0]?.email, email);
    assert.match(context.deliveries[0]?.url ?? "", /\/api\/auth\/magic-link\/verify/);
  });
}

function registerUnknownEmailMagicLinkTest(context: AuthFlowContext): void {
  databaseIt("does not send a magic link to an unknown email", async () => {
    resetDeliveries(context);
    const email = createAuthFlowEmail();

    const response = await requestMagicLink(context, email);
    const user = await db.user.findUnique({ where: { email } });

    assert.equal(response.status, HTTP_UNAUTHORIZED);
    assert.equal(context.deliveries.length, 0);
    assert.equal(user, null);
  });
}

function registerDisabledStaffMagicLinkTest(context: AuthFlowContext): void {
  databaseIt("does not send a magic link to disabled staff", async () => {
    resetDeliveries(context);
    const email = await createTeacher({
      context,
      name: "Professora Desativada",
      isEnabled: false,
    });

    const response = await requestMagicLink(context, email);

    assert.equal(response.status, HTTP_UNAUTHORIZED);
    assert.equal(context.deliveries.length, 0);
  });
}

function registerMagicLinkSessionTest(context: AuthFlowContext): void {
  databaseIt("verifies a magic link into a thirty-day session", async () => {
    resetDeliveries(context);
    const email = await createTeacher({ context, name: "Professora Sessao" });

    await requestMagicLink(context, email);
    const delivery = getOnlyDelivery(context.deliveries);
    const response = await context.auth.handler(new Request(delivery.url));
    const session = await findSessionByEmail(email);

    assert.equal(response.status, HTTP_FOUND);
    assert.equal(sessionDurationSeconds(session), THIRTY_DAY_SESSION_SECONDS);
  });
}

/**
 * Someone disabled between the send and the click must land back on the login
 * screen with the denial code — not on the raw JSON the session hook produces.
 */
function registerDeniedVerificationRedirectTest(context: AuthFlowContext): void {
  databaseIt("redirects a denied verification back to the login screen", async () => {
    resetDeliveries(context);
    const email = await createTeacher({ context, name: "Professora Bloqueada" });

    await requestMagicLink(context, email);
    await db.user.update({ where: { email }, data: { isEnabled: false } });
    const verifyUrl = new URL(getOnlyDelivery(context.deliveries).url);
    verifyUrl.searchParams.set("errorCallbackURL", "/login");
    const response = await context.auth.handler(new Request(verifyUrl));
    const location = new URL(response.headers.get("location") ?? "", TEST_AUTH_ENVIRONMENT.appUrl);

    assert.equal(response.status, HTTP_FOUND);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("error"), STAFF_ACCESS_DENIED_CODE);
    assert.deepEqual(await findSessionsByEmail(email), []);
  });
}

function registerSignOutTest(context: AuthFlowContext): void {
  databaseIt("signs out by invalidating the active session", async () => {
    resetDeliveries(context);
    const email = await createTeacher({ context, name: "Professora Saida" });

    await requestMagicLink(context, email);
    const verifyResponse = await context.auth.handler(
      new Request(getOnlyDelivery(context.deliveries).url),
    );
    const response = await signOut(context, getCookieHeader(verifyResponse));

    assert.equal(response.status, HTTP_OK);
    assert.deepEqual(await findSessionsByEmail(email), []);
  });
}

type CreateTeacherInput = {
  context: AuthFlowContext;
  isEnabled?: boolean;
  name: string;
};

type SessionTiming = {
  createdAt: Date;
  expiresAt: Date;
};

async function createTeacher({
  context,
  isEnabled = true,
  name,
}: CreateTeacherInput): Promise<string> {
  const email = createAuthFlowEmail();
  context.createdEmails.push(email);
  await db.user.create({ data: { email, name, role: "TEACHER", isEnabled } });
  return email;
}

function createAuthFlowEmail(): string {
  return `${AUTH_FLOW_PREFIX}${randomUUID()}@example.com`;
}

function resetDeliveries(context: AuthFlowContext): void {
  context.deliveries.length = 0;
}

function requestMagicLink(context: AuthFlowContext, email: string): Promise<Response> {
  return context.auth.handler(jsonRequest(SIGN_IN_MAGIC_LINK_PATH, { email, callbackURL: "/" }));
}

function signOut(context: AuthFlowContext, cookie: string): Promise<Response> {
  return context.auth.handler(
    new Request(new URL(SIGN_OUT_PATH, TEST_AUTH_ENVIRONMENT.appUrl), {
      method: "POST",
      headers: { cookie, origin: TEST_AUTH_ENVIRONMENT.appUrl },
    }),
  );
}

async function findSessionByEmail(email: string): Promise<SessionTiming> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return db.session.findFirstOrThrow({ where: { userId: user.id } });
}

async function findSessionsByEmail(email: string): Promise<Array<{ id: string }>> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return db.session.findMany({ where: { userId: user.id }, select: { id: true } });
}

function sessionDurationSeconds(session: SessionTiming): number {
  return Math.round(
    (session.expiresAt.getTime() - session.createdAt.getTime()) / MILLISECONDS_PER_SECOND,
  );
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(new URL(path, TEST_AUTH_ENVIRONMENT.appUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getOnlyDelivery(deliveries: MagicLinkDelivery[]): MagicLinkDelivery {
  assert.equal(deliveries.length, 1);
  const delivery = deliveries[0];
  if (delivery === undefined) {
    throw new Error("Expected exactly one magic-link delivery");
  }
  return delivery;
}

function getCookieHeader(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (cookie === undefined) {
    throw new Error("Expected sign-in response to set a session cookie");
  }
  return cookie;
}

async function cleanAuthFlowRows(createdEmails: string[]): Promise<void> {
  const users = await db.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.account.deleteMany({ where: { userId: { in: userIds } } });
  await db.verification.deleteMany({ where: { value: { contains: AUTH_FLOW_PREFIX } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}
