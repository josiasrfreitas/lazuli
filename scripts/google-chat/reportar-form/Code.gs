const TECH_REPORTS_SPACE = "spaces/AAQAm1k9-eM";
const FORM_FIELDS = [
  "O que aconteceu?",
  "Como repetir?",
  "O que deveria acontecer?",
  "Impacto no trabalho",
];

function installReportTrigger() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error("Abra o projeto vinculado ao formulário Tech Reports.");
  const alreadyInstalled = ScriptApp.getUserTriggers(form).some((trigger) =>
    trigger.getHandlerFunction() === "postFormReport" &&
    trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  );
  if (!alreadyInstalled) {
    ScriptApp.newTrigger("postFormReport").forForm(form).onFormSubmit().create();
  }
}

function postFormReport(event) {
  const response = event.response;
  const report = formatFormReport(response.getItemResponses());
  const responseId = response.getId();
  if (!responseId || !report) throw new Error("O formulário não retornou um relato válido.");

  const requestId = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, responseId)
    .slice(0, 16)
    .map((byte) => (byte & 255).toString(16).padStart(2, "0"))
    .join("");

  const url = `https://chat.googleapis.com/v1/${TECH_REPORTS_SPACE}/messages?requestId=${requestId}`;
  const result = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify({ text: report, markupSyntax: "MARKUP_SYNTAX_MARKDOWN" }),
    muteHttpExceptions: true,
  });
  const status = result.getResponseCode();
  if (status < 200 || status >= 300) throw new Error(`Falha ao publicar no Tech Reports (HTTP ${status}).`);
}

function formatFormReport(answers) {
  const fields = new Map();
  const attachmentLinks = [];
  for (const answer of answers) {
    const item = answer.getItem();
    if (item.getType() === FormApp.ItemType.FILE_UPLOAD) {
      for (const id of answer.getResponse()) {
        if (/^[A-Za-z0-9_-]+$/.test(id)) {
          attachmentLinks.push(`[Abrir print ou vídeo](https://drive.google.com/open?id=${id})`);
        }
      }
    } else if (FORM_FIELDS.includes(item.getTitle())) {
      const value = String(answer.getResponse()).trim().replace(/</g, "‹").replace(/>/g, "›");
      if (value) fields.set(item.getTitle(), value.slice(0, 1500));
    }
  }
  if (!fields.size) return null;

  return [
    "**Relato de tecnologia**",
    ...FORM_FIELDS.filter((label) => fields.has(label)).map((label) => `**${label}**  \n${fields.get(label)}`),
    attachmentLinks.length ? `**Print ou vídeo**  \n${attachmentLinks.join("  \n")}` : null,
  ].filter(Boolean).join("\n\n");
}
