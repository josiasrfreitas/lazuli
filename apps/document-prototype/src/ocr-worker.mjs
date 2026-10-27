import { extractFields, identityLines } from "./extract-fields.mjs";
import { parentPort, workerData } from "node:worker_threads";
import { DetectDocumentTextCommand, TextractClient } from "@aws-sdk/client-textract";

// Dedicated prototype worker: no database, Hatchet payloads, document logs or file persistence.
const client = new TextractClient({
  region: process.env.AWS_REGION || "us-east-2",
  maxAttempts: 1,
});
try {
  const result = await client.send(
    new DetectDocumentTextCommand({ Document: { Bytes: workerData } }),
    {
      abortSignal: AbortSignal.timeout(30_000),
    },
  );
  const lines = identityLines(result.Blocks ?? []);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const extraction = extractFields(lines, today);
  parentPort.postMessage({
    status: "done",
    result: {
      fields: Object.fromEntries(
        Object.entries(extraction.fields).map(([key, field]) => [key, field.value]),
      ),
      extraction,
      text: lines.map((line) => line.text).join("\n"),
      lines,
    },
  });
} catch (error) {
  parentPort.postMessage({
    status: "error",
    code: error.name === "AccessDeniedException" ? "ACCESS_DENIED" : "OCR_FAILED",
  });
} finally {
  client.destroy();
}
