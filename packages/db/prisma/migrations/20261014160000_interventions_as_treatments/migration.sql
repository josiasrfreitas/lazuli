BEGIN;

ALTER TABLE "PedagogicalIntervention"
  ADD COLUMN "treatment" TEXT,
  ADD COLUMN "performed_on" DATE;

-- Preserve the meaning of old plans instead of presenting them as completed work.
UPDATE "PedagogicalIntervention"
SET "treatment" = concat_ws(E'\n\n',
      'Registro anterior à simplificação das intervenções.',
      'Objetivo registrado: ' || "objective",
      'Próximo passo registrado: ' || "next_step",
      CASE WHEN "outcome" IS NOT NULL THEN 'Resultado registrado: ' || "outcome" END),
    "performed_on" = ("created_at" AT TIME ZONE 'America/Sao_Paulo')::date;

ALTER TABLE "PedagogicalIntervention"
  ALTER COLUMN "treatment" SET NOT NULL,
  ALTER COLUMN "performed_on" SET NOT NULL,
  DROP CONSTRAINT "PedagogicalIntervention_conclusion_check";
DROP INDEX "PedagogicalIntervention_student_id_created_at_idx";
DROP INDEX "PedagogicalIntervention_teacher_id_status_idx";
DROP INDEX "PedagogicalIntervention_status_due_on_idx";
ALTER TABLE "PedagogicalIntervention"
  RENAME COLUMN "teacher_id" TO "responsible_id";
ALTER TABLE "PedagogicalIntervention"
  RENAME CONSTRAINT "PedagogicalIntervention_teacher_id_fkey" TO "PedagogicalIntervention_responsible_id_fkey";
ALTER TABLE "PedagogicalIntervention"
  DROP COLUMN "objective",
  DROP COLUMN "next_step",
  DROP COLUMN "due_on",
  DROP COLUMN "status",
  DROP COLUMN "concluded_at",
  DROP COLUMN "outcome";
DROP TYPE "InterventionStatus";
CREATE INDEX "PedagogicalIntervention_student_id_performed_on_idx"
  ON "PedagogicalIntervention" ("student_id", "performed_on");
CREATE INDEX "PedagogicalIntervention_responsible_id_performed_on_idx"
  ON "PedagogicalIntervention" ("responsible_id", "performed_on");

-- Keep prior narrative and attribution while removing workflow event types.
UPDATE "PedagogicalFollowUp"
SET "body" = CASE "kind"
  WHEN 'START' THEN E'Registro anterior — início da atuação.\n\n' || "body"
  WHEN 'CONCLUDE' THEN E'Registro anterior — conclusão.\n\n' || "body"
  WHEN 'REOPEN' THEN E'Registro anterior — reabertura.\n\n' || "body"
  WHEN 'ASSIGN' THEN E'Registro anterior — alteração de responsável.\n\n' || "body"
  ELSE "body"
END;
ALTER TABLE "PedagogicalFollowUp" DROP COLUMN "kind";

COMMIT;
