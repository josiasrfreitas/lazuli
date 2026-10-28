CREATE TABLE "RateLimit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "last_request" BIGINT NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
