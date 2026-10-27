# Identity document extraction

`extractIdentityDocument({ lines, today })` is a pure, provider-independent rule set for
one holder's document. `today` is the business date (`YYYY-MM-DD`); OCR line coordinates
are normalized within each page. The prototype's Textract adapter preserves IDs, page,
confidence and bounding boxes. Replacing OCR must not require changing the extraction rules.

The supported practical families are CIN (bilingual combined CPF label / personal number)
and labeled RG (state registration label), with `unknown` when evidence is insufficient.
These are layout families, not claims about exact issue year, issuing state, or authenticity.
CPF-looking numbers alone do not classify a document as CIN. CIN has no separate RG value.

The steps are intentionally small:

1. `profiles.ts` recognizes document families, target labels and competing labels.
2. `association.ts` reads inline values or follows labels to the same column/row, stopping
   at competing labels. Name continuations can span adjacent aligned lines. Geometry takes
   precedence over OCR array order; bounded text-order fallback is explicitly flagged.
3. `values.ts` checks CPF digits and calendar dates, preserves RG representation without
   pretending to validate every state's algorithm, and preserves name accents. Incomplete
   dates stay as evidence for review, never completed by assumption.
4. `extract.ts` resolves each field and returns evidence (label/value line IDs, source text,
   method, OCR confidence and warnings). Conflicting valid values remain ambiguous.

Every result requires review. `ocrConfidence` is the engine's score, not a calibrated
probability that the field association is correct. `found` means a rule found a plausible
value, not a verified identity. No document values should be logged.

Labels ignore spacing, accents and punctuation, including missing bilingual separators,
dotted abbreviations and common `0/O` and `1/I` label substitutions. Original value offsets
preserve names and digits. An intact English label can rescue its damaged Portuguese half.
An unparseable inline suffix does not suppress a value on the following aligned row.
CPF accepts varied separators while retaining exact digits and checksum validation. When
the label is missing in a recognized identity document, a unique standalone checksum-valid
CPF can be recovered with `cpf_label_unrecognized`; conflicting CPFs stay ambiguous.
Birth dates accept one-digit day/month and spaced separators, but still require a birth
label and valid past calendar date. Numeric OCR substitutions are never guessed.

Initial coverage: common bilingual CIN two-column layout and Portuguese RG label layouts,
including separate RG/CPF and multiline names. It does not implement OCR correction, MRZ
parsing, every state-specific checksum or an exhaustive template catalog. The initial fixtures
are synthetic regression tests, not a representative accuracy benchmark. An 80% success rate
must be measured on the school's authorized test sample; it is not established by these tests.

Sources and layout examples are in
[the format research](../../../../docs/research/identity-document-formats-2016-2026.md).
Textract geometry is documented in the
[official API reference](https://docs.aws.amazon.com/textract/latest/APIReference/API_BoundingBox.html).
