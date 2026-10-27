import {
  DetectDocumentTextCommand,
  TextractClient,
  type BoundingBox,
} from "@aws-sdk/client-textract";
import type { IdentityOcrLine } from "@lazuli/domain";

/** OCR engines return geometry and text; field interpretation belongs to domain. */
export interface IdentityOcr {
  read(bytes: Uint8Array): Promise<IdentityOcrLine[]>;
}
const OCR_TIMEOUT_MS = 30_000;
let client: TextractClient | undefined;
export const textractIdentityOcr: IdentityOcr = {
  async read(bytes) {
    client ??= new TextractClient({ maxAttempts: 1 });
    const result = await client.send(
      new DetectDocumentTextCommand({ Document: { Bytes: bytes } }),
      {
        abortSignal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      },
    );
    return (result.Blocks ?? [])
      .filter((block) => block.BlockType === "LINE")
      .map((block, index) => {
        const box = block.Geometry?.BoundingBox;
        return {
          id: block.Id ?? `line-${index}`,
          text: block.Text ?? "",
          page: block.Page ?? 1,
          ...(block.Confidence === undefined ? {} : { confidence: block.Confidence }),
          ...lineBox(box),
        };
      });
  },
};

function lineBox(box: BoundingBox | undefined): Pick<IdentityOcrLine, "box"> {
  if (
    box?.Left === undefined ||
    box.Top === undefined ||
    box.Width === undefined ||
    box.Height === undefined
  )
    return {};
  return { box: { left: box.Left, top: box.Top, width: box.Width, height: box.Height } };
}
