import type { DocumentFamily, FieldAnchor, IdentityField, IdentityOcrLine } from "./types.js";

export function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toUpperCase()
    .replaceAll(/\s+/gu, " ")
    .trim();
}

// Match labels independently of punctuation and spacing, retaining original offsets so
// inline names keep their accents. Character substitutions apply to labels, never values.
function labelText(raw: string): { text: string; ends: number[] } {
  let text = "";
  const ends: number[] = [];
  let offset = 0;
  for (const character of raw) {
    offset += character.length;
    for (const folded of normalized(character)) {
      if (!/[A-Z0-9]/u.test(folded)) continue;
      if (folded === "0") text += "O";
      else if (folded === "1") text += "I";
      else text += folded;
      ends.push(offset);
    }
  }
  return { text, ends };
}
const OTHER = [
  "NOMESOCIAL",
  "SOCIALNAME",
  "FILIACAO",
  "FILIATION",
  "MAE",
  "PAI",
  "SEXO",
  "SEX",
  "NACIONALIDADE",
  "NATIONALITY",
  "NATURALIDADE",
  "PLACEOFBIRTH",
  "VALIDADE",
  "EXPIRY",
  "DATEOFEXPIRY",
  "DATAVALIDADE",
  "DATADEVALIDADE",
  "DATAEMISSAO",
  "DATADEEMISSAO",
  "DATAEXPEDICAO",
  "DATADEEXPEDICAO",
  "ISSUEDATE",
  "ORGAO",
  "DOCORIGEM",
  "DOCUMENTODEORIGEM",
  "LOCAL",
  "ASSINATURA",
  "SIGNATURE",
  "REPUBLICA",
  "GOVERNO",
  "ESTADO",
  "SECRETARIA",
  "CARTEIRA",
  "INSTITUTO",
  "DIRETOR",
  "OBSERVAC",
];
const LABELS: { field: IdentityField; aliases: string[]; translations: string[] }[] = [
  {
    field: "cpf",
    aliases: ["REGISTROGERALCPF", "CPF", "PERSONALNUMBER"],
    translations: ["PERSONALNUMBER"],
  },
  {
    field: "birthDate",
    aliases: [
      "DATADENASCIMENTO",
      "DATEDENASCIMENTO",
      "DATANASCIMENTO",
      "DATENASCIMENTO",
      "DATADENASC",
      "DATEDENASC",
      "DATANASC",
      "DATENASC",
      "NASCIMENTO",
      "DATEOFBIRTH",
    ],
    translations: ["DATEOFBIRTH"],
  },
  { field: "name", aliases: ["NOMECOMPLETO", "NOME", "NAME"], translations: ["NAME"] },
  {
    field: "rg",
    aliases: ["REGISTROGERAL", "RG", "IDENTITYNUMBER", "REGISTRATIONNUMBER"],
    translations: ["RG", "REGISTRATIONNUMBER", "IDENTITYNUMBER"],
  },
];
const MIN_LONG_TRANSLATION_LENGTH = 4;
const MAX_TRANSLATION_START = 40;
function labelMatch(text: string): { field: IdentityField; end: number } | undefined {
  // Prefer the full bilingual label, even when its Portuguese half is damaged
  // or would otherwise match a shorter label (for example "Registro Geral").
  for (const { field, translations } of LABELS) {
    for (const translation of translations.filter(
      (value) => value.length > MIN_LONG_TRANSLATION_LENGTH,
    )) {
      const index = text.indexOf(translation);
      if (index !== -1 && index <= MAX_TRANSLATION_START && /^[A-Z]*$/u.test(text.slice(0, index)))
        return { field, end: index + translation.length };
    }
  }
  for (const { field, aliases, translations } of LABELS) {
    const alias = aliases.find((value) => text.startsWith(value));
    if (!alias) continue;
    let end = alias.length;
    for (const translation of translations) {
      if (text.slice(end).startsWith(translation)) end += translation.length;
    }
    return { field, end };
  }
  return undefined;
}
export function documentFamily(lines: readonly IdentityOcrLine[]): DocumentFamily {
  const texts = lines.map((line) => labelText(line.text).text);
  if (
    texts.some((text) => /REGISTROGERALCPF|PERSONALNUMBER|CARTEIRADEIDENTIDADENACIONAL/u.test(text))
  )
    return "cin";
  if (texts.some((text) => /^(?:REGISTROGERAL|RG|IDENTITYNUMBER|REGISTRATIONNUMBER)/u.test(text)))
    return "rg";
  return "unknown";
}
export function anchorFor(line: IdentityOcrLine): FieldAnchor | undefined {
  const compact = labelText(line.text);
  if (OTHER.some((label) => compact.text.startsWith(label)))
    return { line, field: "other", remainder: "" };
  const match = labelMatch(compact.text);
  if (!match) return undefined;
  return {
    line,
    field: match.field,
    remainder: line.text
      .slice(compact.ends[match.end - 1])
      .replace(/^[\s:;.,/|()\-–—]+/u, "")
      .trim(),
  };
}
