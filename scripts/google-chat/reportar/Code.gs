const REPORT_SPACE = "spaces/AAQAm1k9-eM";
const REPORT_COMMAND = 1;
const REPORT_FORM_COMMAND = 2;
const REPORT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdF0_f1YcGAqRUY0R4R10ZtyH8gRUtrpivCmKoTRS-txYFe2g/viewform";
const REPORT_FIELDS = [
  { name: "problem", label: "O que aconteceu?", hint: "Inclua a mensagem de erro, se apareceu.", limit: 1200 },
  { name: "steps", label: "Como repetir?", hint: "Conte o que você fez até chegar ao problema.", limit: 1200 },
  { name: "expected", label: "O que deveria acontecer?", limit: 600 },
];
const IMPACT_OPTIONS = [
  "Consegui continuar",
  "Consegui continuar com dificuldade",
  "Não consegui continuar",
];

function onAppCommand(event) {
  const command = event.chat?.appCommandPayload;
  const commandId = Number(command?.appCommandMetadata?.appCommandId);
  if (commandId !== REPORT_COMMAND && commandId !== REPORT_FORM_COMMAND) return;
  if (command.space?.name !== REPORT_SPACE) {
    return dialogNotice("Use este comando no espaço Tech Reports.");
  }
  if (commandId === REPORT_FORM_COMMAND) return openReportForm();

  return {
    action: {
      navigations: [{
        pushCard: {
          header: { title: "Reportar problema" },
          sections: [{
            widgets: [
              { textParagraph: { text: "Depois de publicar, anexe um print ou vídeo da tela como resposta ao relato. Oculte dados de alunos e famílias." } },
              ...REPORT_FIELDS.map(({ name, label, hint, limit }) => ({
                textInput: {
                  name,
                  label,
                  hintText: hint,
                  type: "MULTIPLE_LINE",
                  validation: { characterLimit: limit },
                },
              })),
              {
                selectionInput: {
                  name: "impact",
                  label: "Impacto no trabalho",
                  type: "RADIO_BUTTON",
                  items: IMPACT_OPTIONS.map((text) => ({ text, value: text })),
                },
              },
              {
                buttonList: {
                  buttons: [{
                    text: "Publicar relato",
                    onClick: {
                      action: {
                        function: "submitReport",
                        requiredWidgets: [...REPORT_FIELDS.map(({ name }) => name), "impact"],
                      },
                    },
                  }],
                },
              },
            ],
          }],
        },
      }],
    },
  };
}

function openReportForm() {
  return {
    action: {
      navigations: [{
        pushCard: {
          header: { title: "Reportar problema com anexo" },
          sections: [{
            widgets: [
              { textParagraph: { text: "Preencha o relato e envie o print ou vídeo no mesmo formulário." } },
              {
                buttonList: {
                  buttons: [{
                    text: "Abrir formulário",
                    onClick: { openLink: { url: REPORT_FORM_URL } },
                  }],
                },
              },
            ],
          }],
        },
      }],
    },
  };
}

function submitReport(event) {
  if (event.chat?.buttonClickedPayload?.space?.name !== REPORT_SPACE) {
    return dialogNotice("Use /reportar no espaço Tech Reports.");
  }

  const inputs = event.commonEventObject?.formInputs ?? {};
  const values = REPORT_FIELDS.map((field) => ({ ...field, value: reportInput(inputs, field.name) }));
  const impact = reportInput(inputs, "impact");
  if (values.some(({ value, limit }) => !value || value.length > limit) || !IMPACT_OPTIONS.includes(impact)) {
    return dialogNotice("Confira os campos antes de publicar o relato.");
  }

  const text = [
    "*Problema de tecnologia*",
    ...values.map(({ label, value }) => `*${label}*\n${escapeChatText(value)}`),
    `*Impacto no trabalho*\n${impact}`,
    "Anexe um print ou vídeo da tela como resposta a este relato. Oculte dados de alunos e famílias.",
  ].join("\n\n");

  return {
    hostAppDataAction: {
      chatDataAction: { createMessageAction: { message: { text } } },
    },
  };
}

function reportInput(inputs, name) {
  return inputs[name]?.stringInputs?.value?.[0]?.trim() ?? "";
}

function escapeChatText(value) {
  return value.replace(/</g, "‹").replace(/>/g, "›");
}

function dialogNotice(text) {
  return { action: { notification: { text } } };
}
