import {
  MAX_PLACEMENT_FILE_BYTES,
  MAX_UPLOAD_FILE_MB,
  type placementFileSchema,
  type z,
} from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";

type PlacementFileInput = Pick<z.infer<typeof placementFileSchema>, "base64" | "contentType">;

const FILE_SIGNATURES: Readonly<Record<PlacementFileInput["contentType"], Buffer>> = {
  "application/pdf": Buffer.from("%PDF-", "ascii"),
  "image/jpeg": Buffer.from("ffd8ff", "hex"),
  "image/png": Buffer.from("89504e470d0a1a0a", "hex"),
};

export function placementFileBytes(values: PlacementFileInput): Buffer {
  const bytes = Buffer.from(values.base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PLACEMENT_FILE_BYTES)
    throw badRequest(`Envie um arquivo de até ${MAX_UPLOAD_FILE_MB} MB.`);
  if (!FILE_SIGNATURES[values.contentType].every((byte, index) => bytes[index] === byte))
    throw badRequest("O conteúdo não corresponde a um arquivo PDF, JPG ou PNG válido.");
  return bytes;
}
