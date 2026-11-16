import { useEffect } from "react";
import {
  documentToastKey,
  fileJobState,
  isFileProcessingStale,
  notifyFileJob,
} from "~/features/shared/file-job-toast";
import { trpc } from "~/lib/trpc";
import { ENROLLMENT_DOCUMENTS } from "./model";
import type { EnrollmentDocuments } from "./use-enrollment-documents";

type DocumentFile = NonNullable<EnrollmentDocuments["query"]["data"]>["files"][number];
type Retry = (id: string) => void;
function notifyDocument(file: DocumentFile, options: { token: string; retry: Retry }): void {
  const definition = ENROLLMENT_DOCUMENTS.find((row) => row.id === file.kind);
  const failed = file.status === "FAILED" || isFileProcessingStale(file);
  const canRetry = definition?.extracts && file.format !== "pdf" && failed;
  notifyFileJob({
    key: documentToastKey(options.token, file.kind),
    state: fileJobState(file),
    label: definition?.title ?? file.title ?? "Documento",
    retry: canRetry ? () => options.retry(file.id) : undefined,
  });
}
export function useDocumentFileNotices(input: {
  files: DocumentFile[] | undefined;
  token: string | undefined;
}): void {
  const utils = trpc.useUtils();
  const retry = trpc.studentDocuments.retry.useMutation({
    onSuccess: () => utils.studentDocuments.invalidate(),
    onError: (error, values) => {
      const file = input.files?.find((row) => row.id === values.id);
      if (file && input.token)
        notifyFileJob({
          key: documentToastKey(input.token, file.kind),
          state: "FAILED",
          label: error.message,
          retry: () => retry.mutate(values),
        });
    },
  });
  useEffect(() => {
    if (!input.token) return;
    for (const file of input.files ?? []) {
      if (retry.isPending && retry.variables?.id === file.id) continue;
      notifyDocument(file, { token: input.token, retry: (id) => retry.mutate({ id }) });
    }
  }, [input, retry]);
}
