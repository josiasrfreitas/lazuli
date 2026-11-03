import type { EmailBody } from "@lazuli/integrations";

/** A reset link also lets pre-provisioned staff create their first password. */
export function createPasswordResetEmail(url: string, registering = false): EmailBody {
  const title = registering ? "Cadastre sua senha" : "Recupere sua senha";
  const action = registering ? "Cadastrar minha senha" : "Escolher nova senha";
  const description = registering
    ? "Seu email já está cadastrado na escola. Abra o link para escolher sua senha no site da Lazuli."
    : "Abra o link para escolher uma nova senha no site da Lazuli.";
  const link = url
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&#39;");
  return {
    text: `${title} da Lazuli\n\n${description}\n${url}\n\nO link vale por 15 minutos e pode ser usado uma vez. Após salvar, entre com seu email e a nova senha. Suas sessões anteriores serão encerradas.\n\nSe você não pediu esta alteração, ignore este email. Sua senha continuará a mesma.`,
    html: `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title} da Lazuli</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f2;color:#0f1e3d;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:40px 20px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px">
        <tr><td style="padding-bottom:28px;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:3px;color:#0f1e3d">LAZULI<span style="color:#d8ad4a">.</span></td></tr>
        <tr><td style="padding:32px 28px;background-color:#ffffff;border-radius:12px">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;line-height:1.15">${title}.</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569">${description}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td bgcolor="#0f1e3d" style="border-radius:8px;text-align:center;mso-padding-alt:16px 28px">
              <a href="${link}" style="display:inline-block;padding:16px 28px;border:1px solid #0f1e3d;border-radius:8px;color:#ffffff;font-size:16px;line-height:20px;font-weight:600;text-decoration:none;mso-padding-alt:0">${action}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#475569">O link vale por <strong>15 minutos</strong> e pode ser usado uma vez. Após salvar, entre com seu email e a nova senha. Suas sessões anteriores serão encerradas.</p>
        </td></tr>
        <tr><td style="padding-top:24px;font-size:13px;line-height:1.6;color:#475569">Se você não pediu esta alteração, ignore este email. Sua senha continuará a mesma.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
