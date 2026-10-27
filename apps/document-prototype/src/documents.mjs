export const DOCUMENTS = [
  {
    id: "student",
    title: "Identidade do aluno",
    detail: "RG ou CIN · frente e verso",
    extracts: true,
  },
  {
    id: "guardian",
    title: "Identidade do responsável",
    detail: "Para aluno menor de idade · frente e verso",
    extracts: true,
  },
  {
    id: "residence",
    title: "Comprovante de residência",
    detail: "Foto do comprovante completo",
    extracts: false,
  },
  {
    id: "payment",
    title: "Pagamento da matrícula",
    detail: "Comprovante da taxa de matrícula",
    extracts: false,
  },
];
export function documentFor(id) {
  return DOCUMENTS.find((document) => document.id === id);
}
export function sessionSummary(session) {
  return {
    expiresAt: session.expiresAt,
    status: session.status,
    result: session.result,
    code: session.code,
    documents: Object.fromEntries(
      Object.entries(session.documents).map(([id, doc]) => [
        id,
        {
          status: doc.status,
          revision: doc.revision,
          result: doc.result,
          code: doc.code,
          hasImage: Boolean(doc.bytes),
        },
      ]),
    ),
  };
}
// Polling may update untouched fields, but never replace a person's manual edit.
export function prefill(fields, documents, touched) {
  const next = { ...fields };
  for (const [id, prefix] of [
    ["student", ""],
    ["guardian", "guardian"],
  ]) {
    const document = documents?.[id];
    if (document?.status !== "done") continue;
    for (const key of ["name", "cpf", "rg", "birthDate"]) {
      const target = prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;
      const value = document.result?.fields?.[key];
      if (value && !touched.has(target)) next[target] = value;
    }
  }
  return next;
}
