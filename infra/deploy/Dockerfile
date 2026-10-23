# The same immutable image runs web, worker and migrations.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.6.0
COPY . .
RUN LEFTHOOK=0 pnpm install --frozen-lockfile
# Build values are deliberately synthetic. Runtime secrets never enter build layers.
RUN APP_URL=https://build.invalid BETTER_AUTH_URL=https://build.invalid \
    BETTER_AUTH_SECRET=build-only-not-a-runtime-secret-000000000000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    EMAIL_FROM=build@build.invalid GOOGLE_CLIENT_ID=build GOOGLE_CLIENT_SECRET=build \
    pnpm --filter @lazuli/web build
RUN pnpm --filter @lazuli/worker typecheck

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.6.0
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["pnpm", "start:remote"]
