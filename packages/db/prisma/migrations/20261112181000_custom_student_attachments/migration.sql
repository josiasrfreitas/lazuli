ALTER TABLE "StudentDocumentFile" DROP CONSTRAINT "StudentDocumentFile_kind_check";
ALTER TABLE "StudentDocumentFile" ADD CONSTRAINT "StudentDocumentFile_kind_check"
CHECK ("kind" IN ('student','guardian','residence','payment','photo') OR "kind" ~ '^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
