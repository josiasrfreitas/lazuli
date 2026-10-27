import assert from "node:assert/strict";
import { test } from "node:test";
import { identityLines, extractFields } from "../src/extract-fields.mjs";

test("Textract adapter preserves geometry, page and confidence through the real extraction", () => {
  const lines = identityLines([
    { Id: "word", BlockType: "WORD", Text: "ignored" },
    {
      Id: "label",
      BlockType: "LINE",
      Text: "Registro Geral - CPF / Personal Number",
      Page: 1,
      Confidence: 99,
      Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.5, Height: 0.025 } },
    },
    {
      Id: "sex",
      BlockType: "LINE",
      Text: "Sexo / Sex",
      Page: 1,
      Confidence: 99,
      Geometry: { BoundingBox: { Left: 0.8, Top: 0.2, Width: 0.1, Height: 0.025 } },
    },
    {
      Id: "value",
      BlockType: "LINE",
      Text: "529.982.247-25",
      Page: 1,
      Confidence: 98,
      Geometry: { BoundingBox: { Left: 0.1, Top: 0.24, Width: 0.3, Height: 0.025 } },
    },
  ]);
  const result = extractFields(lines, "2026-10-26");
  assert.equal(result.family, "cin");
  assert.equal(result.fields.cpf.value, "529.982.247-25");
  assert.equal(result.fields.cpf.candidates[0].ocrConfidence, 98);
  assert.deepEqual(result.fields.cpf.candidates[0].lineIds, ["label", "value"]);
  assert.equal(result.fields.rg.status, "not_applicable");
});
