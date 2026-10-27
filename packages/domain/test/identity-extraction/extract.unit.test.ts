import assert from "node:assert/strict";
import { test } from "node:test";
import { extractIdentityDocument } from "../../src/identity-extraction/extract.js";
import type { IdentityOcrLine } from "../../src/identity-extraction/types.js";

const today = "2026-10-26";
function line(
  id: string,
  [text, left, top, width = 0.35]: [string, number, number, number?],
): IdentityOcrLine {
  return { id, text, page: 1, confidence: 99, box: { left, top, width, height: 0.025 } };
}
function cin(): IdentityOcrLine[] {
  return [
    line("name-label", ["Name / Name", 0.1, 0.1]),
    line("name-value", ["MARIA ÁLVARES DE EXEMPLO", 0.1, 0.14, 0.7]),
    line("social-label", ["Nome Social / Social Name", 0.1, 0.2]),
    line("cpf-label", ["Registro Geral - CPF / Personal Number", 0.1, 0.3, 0.6]),
    line("sex-label", ["Sex / Sex", 0.8, 0.3, 0.15]),
    line("cpf-value", ["529.982.247-25", 0.1, 0.34]),
    line("sex-value", ["F", 0.8, 0.34, 0.05]),
    line("birth-label", ["Data de Nascimento / Date of Birth", 0.1, 0.45]),
    line("nationality-label", ["Nacionalidade / Nationality", 0.6, 0.45]),
    line("birth-value", ["12/05/1970", 0.1, 0.49]),
    line("nationality-value", ["BRA", 0.6, 0.49]),
    line("place-label", ["Naturalidade / Place of Birth", 0.1, 0.6]),
    line("expiry-label", ["Validade / Expiry", 0.6, 0.6]),
    line("place-value", ["CIDADE FICTÍCIA-SE", 0.1, 0.64]),
    line("expiry-value", ["21/03/2036", 0.6, 0.64]),
  ];
}
void test("CIN interleaved columns use geometry, preserve name and never duplicate CPF into RG", () => {
  const result = extractIdentityDocument({ lines: cin(), today });
  assert.equal(result.family, "cin");
  assert.equal(result.fields.name.value, "MARIA ÁLVARES DE EXEMPLO");
  assert.equal(result.fields.cpf.value, "529.982.247-25");
  assert.equal(result.fields.birthDate.value, "12/05/1970");
  assert.equal(result.fields.rg.status, "not_applicable");
  assert.equal(result.fields.rg.value, null);
  assert.deepEqual(result.fields.birthDate.candidates[0]?.lineIds, ["birth-label", "birth-value"]);
  assert.equal(result.fields.birthDate.candidates[0]?.method, "geometry");
  assert.equal(result.requiresReview, true);
});
void test("geometry results are independent of OCR array order", () => {
  const result = extractIdentityDocument({ lines: cin().toReversed(), today });
  assert.equal(result.fields.cpf.value, "529.982.247-25");
  assert.equal(result.fields.birthDate.value, "12/05/1970");
  assert.equal(result.fields.name.value, "MARIA ÁLVARES DE EXEMPLO");
});
void test("legacy RG keeps distinct RG and CPF, accents, leading zeros and alphabetic prefix", () => {
  const lines = [
    line("rg", ["REGISTRO GERAL", 0.1, 0.1]),
    line("rg-v", ["MG-01.234.567", 0.1, 0.14]),
    line("issue", ["DATA DE EXPEDIÇÃO", 0.6, 0.1]),
    line("issue-v", ["10/10/2020", 0.6, 0.14]),
    line("name", ["NOME", 0.1, 0.25]),
    line("name-v", ["MARIA ÁLVARES", 0.1, 0.29]),
    line("name-v2", ["DE EXEMPLO", 0.1, 0.325]),
    line("parent", ["FILIAÇÃO", 0.1, 0.4]),
    line("parent-v", ["ANA DE EXEMPLO", 0.1, 0.44]),
    line("birth", ["DATA NASCIMENTO", 0.6, 0.5]),
    line("birth-v", ["03.07.1988", 0.6, 0.54]),
    line("cpf", ["CPF: 52998224725", 0.1, 0.7]),
  ];
  const result = extractIdentityDocument({ lines, today });
  assert.equal(result.family, "rg");
  assert.equal(result.fields.rg.value, "MG-01.234.567");
  assert.equal(result.fields.cpf.value, "529.982.247-25");
  assert.equal(result.fields.name.value, "MARIA ÁLVARES DE EXEMPLO");
  assert.equal(result.fields.birthDate.value, "03/07/1988");
  assert.deepEqual(result.fields.rg.candidates[0]?.warnings, ["rg_format_only"]);
});
void test("missing birth value cannot borrow expiry from adjacent column", () => {
  const result = extractIdentityDocument({
    lines: cin().filter((entry) => entry.id !== "birth-value"),
    today,
  });
  assert.equal(result.fields.birthDate.status, "missing");
  assert.equal(result.fields.birthDate.value, null);
});
void test("multiple contradictory CPF values are ambiguous, never first-match wins", () => {
  const lines = [
    ...cin(),
    line("cpf2", ["CPF", 0.1, 0.8]),
    line("cpf2-v", ["111.444.777-35", 0.1, 0.84]),
  ];
  const result = extractIdentityDocument({ lines, today });
  assert.equal(result.fields.cpf.status, "ambiguous");
  assert.equal(result.fields.cpf.value, null);
  assert.equal(result.fields.cpf.candidates.length, 2);
});
void test("invalid CPF and impossible dates retain evidence but cannot populate values", () => {
  const lines = [
    line("cpf", ["CPF: 111.111.111-11", 0.1, 0.1]),
    line("birth", ["NASCIMENTO: 31/02/2000", 0.1, 0.4]),
  ];
  const result = extractIdentityDocument({ lines, today });
  assert.equal(result.fields.cpf.status, "invalid");
  assert.equal(result.fields.birthDate.status, "invalid");
  assert.equal(result.fields.cpf.value, null);
  assert.equal(result.fields.birthDate.value, null);
  assert.deepEqual(result.fields.cpf.candidates[0]?.warnings, ["cpf_checksum_failed"]);
});
void test("partial dates remain incomplete, without inventing a day", () => {
  const result = extractIdentityDocument({
    lines: [line("date", ["DATA DE NASCIMENTO: 05/1970", 0.1, 0.2])],
    today,
  });
  assert.equal(result.fields.birthDate.value, null);
  assert.deepEqual(result.fields.birthDate.candidates[0]?.warnings, ["incomplete_birth_date"]);
  assert.equal(result.fields.birthDate.candidates[0]?.raw, "05/1970");
});
void test("text-only interleaved numeric fields work with an explicit weaker-evidence warning", () => {
  const lines = cin().map(({ box: _box, ...entry }) => entry);
  const result = extractIdentityDocument({ lines, today });
  assert.equal(result.fields.cpf.value, "529.982.247-25");
  assert.equal(result.fields.birthDate.value, "12/05/1970");
  assert.deepEqual(result.fields.birthDate.candidates[0]?.warnings, ["geometry_unavailable"]);
});
void test("never matches values from another page or interprets unlabeled numbers as RG", () => {
  const result = extractIdentityDocument({
    lines: [
      line("label", ["CPF", 0.1, 0.1]),
      { ...line("value", ["529.982.247-25", 0.1, 0.14]), page: 2 },
    ],
    today,
  });
  assert.equal(result.fields.cpf.status, "missing");
  assert.equal(result.fields.rg.status, "missing");
  assert.equal(result.family, "unknown");
});
void test("inline bilingual labels are consumed fully, including accented legal names", () => {
  const result = extractIdentityDocument({
    lines: [
      line("name", ["Nome / Name: JOÃO DA SILVA", 0.1, 0.2]),
      line("birth", ["Data de Nascimento / Date of Birth: 29/02/2000", 0.1, 0.3]),
    ],
    today,
  });
  assert.equal(result.fields.name.value, "JOÃO DA SILVA");
  assert.equal(result.fields.birthDate.value, "29/02/2000");
});
void test("birth labels tolerate OCR Date de Nascimento and use the intact English label", () => {
  for (const label of [
    "Date de Nascimento / Date of Birth",
    "Dala de Nascimenlo / Date of Birth",
  ]) {
    const lines = cin().map((entry) =>
      entry.id === "birth-label" ? { ...entry, text: label } : entry,
    );
    const result = extractIdentityDocument({ lines, today });
    assert.equal(result.fields.birthDate.value, "12/05/1970", label);
    assert.equal(result.fields.birthDate.candidates[0]?.method, "geometry");
    const missing = extractIdentityDocument({
      lines: lines.filter((entry) => entry.id !== "birth-value"),
      today,
    });
    assert.equal(missing.fields.birthDate.value, null);
  }
});
