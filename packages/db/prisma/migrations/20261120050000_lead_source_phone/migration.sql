BEGIN;

LOCK TABLE "AdmissionCandidate" IN ACCESS EXCLUSIVE MODE;

CREATE FUNCTION lead_phone_key(phone text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE
    WHEN phone !~ '^[[:space:]]*\+' AND length(digits) IN (10, 11) THEN '55' || digits
    ELSE nullif(digits, '')
  END FROM (SELECT regexp_replace(phone, '[^0-9]', '', 'g') AS digits) normalized
$$;

DO $$
DECLARE conflicting_ids text;
BEGIN
  SELECT string_agg(ids, '; ') INTO conflicting_ids FROM (
    SELECT string_agg(id::text, ', ' ORDER BY id) AS ids
    FROM "AdmissionCandidate"
    WHERE deleted_at IS NULL AND lead_phone_key(phone) IS NOT NULL
    GROUP BY lead_phone_key(phone) HAVING count(*) > 1
  ) collisions;
  IF conflicting_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Telefones duplicados. Revise os leads por ID: %', conflicting_ids;
  END IF;
END $$;

CREATE UNIQUE INDEX admission_candidate_phone_unique ON "AdmissionCandidate" (lead_phone_key(phone))
WHERE deleted_at IS NULL;

CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'INSTAGRAM', 'WHATSAPP', 'WEBSITE', 'SCHOOL_VISIT', 'GOOGLE', 'OTHER');
ALTER TABLE "AdmissionCandidate" RENAME COLUMN source TO source_detail;
ALTER TABLE "AdmissionCandidate" ADD COLUMN source "LeadSource";
UPDATE "AdmissionCandidate" SET source = (CASE lower(trim(source_detail))
  WHEN 'indicação' THEN 'REFERRAL'
  WHEN 'indicação de aluno' THEN 'REFERRAL'
  WHEN 'instagram' THEN 'INSTAGRAM'
  WHEN 'whatsapp' THEN 'WHATSAPP'
  WHEN 'site' THEN 'WEBSITE'
  WHEN 'visita à escola' THEN 'SCHOOL_VISIT'
  WHEN 'google' THEN 'GOOGLE'
  WHEN 'pesquisa no google' THEN 'GOOGLE'
  WHEN '' THEN NULL
  ELSE 'OTHER'
END)::"LeadSource" WHERE source_detail IS NOT NULL;
UPDATE "AdmissionCandidate" SET source_detail = NULL WHERE source IS DISTINCT FROM 'OTHER';
COMMIT;
