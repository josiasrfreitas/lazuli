# Sentry operation

The web and worker runtimes capture errors from their shared packages. Pure domain and
validation modules have no SDK dependency. Collection is enabled only when `LAZULI_ENV=prod`
(server/worker) or `NEXT_PUBLIC_SENTRY_ENVIRONMENT=prod` (browser). A DSN is also required.
Staging and ordinary development/test runs do not send telemetry.

An explicit `SENTRY_VERIFY=1` / `NEXT_PUBLIC_SENTRY_VERIFY=1` enables a synthetic local
verification in the separate `verification` environment. Never persist these flags in a
production runtime configuration. Disable them after the verification.

## Exceptions

Send the original Error, its cause and its stack, rather than a new Error containing a catch
label or a serialized log object. `reportError` and error/fatal logs carrying `safeError(error)`
use the runtime's installed reporter. The same Error instance is reported once. Expected
validation, authorization and business rejections are not exception events.

The tRPC middleware handles error results as well as thrown exceptions. File transports report
unexpected errors before returning a safe response. Worker handlers report caught failures
before persisting their failure status. Generation and reconciliation rethrow the original
exception. Monitoring transport failures never replace application failures.

Request/queue payloads, cookies, headers, user identity, database values, local variables,
breadcrumbs and AI content are excluded. Replay masks all text/inputs and blocks media.
Error messages retain their diagnostic text, with common identifying values redacted.

## Production configuration

Set the GitHub environment `app-prod` variable `SENTRY_WEB_DSN` and build-only secret
`SENTRY_AUTH_TOKEN` for source-map upload. The Docker build uses the public DSN and deployed
commit SHA for the browser bundle and the Next.js server, which also serves the tRPC API.
Set `SENTRY_WORKER_DSN` in the prod runtime configuration to enable worker reporting.

The upload token is a BuildKit secret, never an ARG or image ENV. A prod application build fails
if that secret is absent. `withSentryConfig` uploads the Next/Turbopack source maps, including
workspace package sources, and removes browser maps after upload. Production deployment must
not proceed until a compiled local verification resolves an event to its original source line.

The worker still runs source TypeScript through `tsx`, preloading its SDK before application
imports and enabling Node source-map support. Original TypeScript files remain in the image
for source context. Verify the worker event has the original `.ts` function, line and source
context; do not assert success merely because an event arrived.

## Validation

Run focused reporting/policy tests, then the workspace test tiers serially. Smoke-check every
runtime package's exports, and exercise representative failures through the actual Next and
worker entry points. Check original exception text, causes, package frames, environments and
source context in Sentry. Temporary verification triggers must be removed after the check.
