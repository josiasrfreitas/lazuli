-- Enable trigram-backed search for GRE-21 student lookup.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Student_full_name_trgm_idx"
ON "Student"
USING GIN ("full_name" gin_trgm_ops);

CREATE INDEX "Student_document_number_trgm_idx"
ON "Student"
USING GIN ("document_number" gin_trgm_ops);

CREATE INDEX "Student_phone_trgm_idx"
ON "Student"
USING GIN ("phone" gin_trgm_ops);

CREATE INDEX "Student_email_trgm_idx"
ON "Student"
USING GIN ("email" gin_trgm_ops);
