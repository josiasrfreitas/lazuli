/**
 * @implements GRE-53 — replace with CSV/PDF builders, GCS writes, and artifact completion stamps.
 */

import type { ReportGeneratePayload } from "@lazuli/job-contracts";
import { reportGeneratePayloadSchema } from "@lazuli/job-contracts";

export type ProcessReportGenerateResult = {
  artifactId: string;
};

export async function processReportGenerate(input: {
  payload: ReportGeneratePayload;
}): Promise<ProcessReportGenerateResult> {
  const payload = reportGeneratePayloadSchema.parse(input.payload);
  process.stdout.write(`[worker-handlers] report-generate artifactId=${payload.artifactId}\n`);
  return { artifactId: payload.artifactId };
}
