import { extractIdentityDocument } from "@lazuli/domain";

/** Only this adapter knows Textract's block shape; the extraction rules accept neutral lines. */
export function identityLines(blocks) {
  return blocks
    .filter((block) => block.BlockType === "LINE")
    .map((block, index) => {
      const box = block.Geometry?.BoundingBox;
      return {
        id: block.Id ?? `line-${index}`,
        text: block.Text ?? "",
        page: block.Page ?? 1,
        ...(block.Confidence === undefined ? {} : { confidence: block.Confidence }),
        ...(box
          ? { box: { left: box.Left, top: box.Top, width: box.Width, height: box.Height } }
          : {}),
      };
    });
}
export function extractFields(lines, today) {
  return extractIdentityDocument({ lines, today });
}
