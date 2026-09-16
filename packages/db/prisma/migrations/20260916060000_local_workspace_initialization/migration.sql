CREATE TABLE "local_workspace_initializations" (
  "key" TEXT NOT NULL,
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "local_workspace_initializations_pkey" PRIMARY KEY ("key")
);
