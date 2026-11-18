/** A one-page, Latin-1 PDF for a synthetic registration attachment. */
export function registrationPdf(title: string, student: string, holder: string): Buffer {
  const escape = (value: string): string => value.replace(/[()\\]/g, "\\$&");
  const lines = [
    "Lazuli - Escola de demonstração",
    title,
    `Aluno: ${student}`,
    `Titular: ${holder}`,
    "Documento fictício para validação de cadastro.",
  ];
  const content = `BT /F1 14 Tf 52 760 Td 24 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f "];
  for (const [i, object] of objects.entries()) {
    offsets.push(`${String(pdf.length).padStart(10, "0")} 00000 n `);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  return Buffer.from(
    `${pdf}xref\n0 ${offsets.length}\n${offsets.join("\n")}\ntrailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    "latin1",
  );
}
