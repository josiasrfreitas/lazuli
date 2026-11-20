# The same immutable image runs web, worker and migrations.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Build and runtime scripts use the dependencies installed from the frozen lockfile.
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.6.0
COPY . .
ARG LAZULI_BUILD_ENV
ARG SENTRY_WEB_DSN
ARG SENTRY_RELEASE
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$LAZULI_BUILD_ENV \
    NEXT_PUBLIC_SENTRY_DSN=$SENTRY_WEB_DSN \
    NEXT_PUBLIC_SENTRY_RELEASE=$SENTRY_RELEASE \
    SENTRY_RELEASE=$SENTRY_RELEASE
RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm --filter @lazuli/db generate
# Build values are deliberately synthetic. Runtime secrets never enter build layers.
RUN --mount=type=secret,id=sentry_auth_token \
    if [ "$LAZULI_BUILD_ENV" = prod ]; then test -s /run/secrets/sentry_auth_token; fi \
    && export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    && CI=1 APP_URL=https://build.invalid BETTER_AUTH_URL=https://build.invalid \
    BETTER_AUTH_SECRET=build-only-not-a-runtime-secret-000000000000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    EMAIL_FROM=build@build.invalid \
    pnpm --filter @lazuli/web build
RUN pnpm --filter @lazuli/worker typecheck

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.6.0
COPY --from=build --chown=node:node /app /app
# The Next.js server uses the same public DSN and release as the browser bundle.
ARG SENTRY_WEB_DSN
ARG SENTRY_RELEASE
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false \
    SENTRY_WEB_DSN=$SENTRY_WEB_DSN \
    SENTRY_RELEASE=$SENTRY_RELEASE
USER node
EXPOSE 3000
CMD ["pnpm", "start:remote"]
