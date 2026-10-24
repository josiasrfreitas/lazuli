import type { EmailBody } from "@lazuli/integrations";

/** Email-safe tables and inline styles; branding still works with remote images disabled. */
export function createMagicLinkEmail(url: string): EmailBody {
  const link = escapeHtml(url);
  return {
    text: `Seu acesso à Lazuli\n\nEntre pelo link abaixo:\n${url}\n\nSe você não pediu este link, pode ignorar este email.`,
    html: `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Seu acesso à Lazuli</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f2;color:#0f1e3d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Seu link para entrar na Lazuli está aqui.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f5f2">
    <tr><td align="center" style="padding:40px 20px">
      <!--[if mso]><table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px">
        <tr><td style="padding:0 0 32px;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:3px;color:#0f1e3d">LAZULI<span style="color:#d8ad4a">.</span></td></tr>
        <tr><td style="padding:32px 28px;background-color:#ffffff;border-radius:12px">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:400;color:#0f1e3d">Seu acesso, pronto.</h1>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#475569">Use o botão abaixo para entrar na Lazuli.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td bgcolor="#0f1e3d" style="border-radius:8px;text-align:center;mso-padding-alt:16px 28px">
              <a href="${link}" style="display:inline-block;padding:16px 28px;border:1px solid #0f1e3d;border-radius:8px;color:#ffffff;font-size:16px;line-height:20px;font-weight:600;text-decoration:none;mso-padding-alt:0">Entrar na Lazuli</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">Se você não pediu este link, pode ignorar este email.</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
