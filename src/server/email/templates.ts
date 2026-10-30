/**
 * Modelos de e-mail transacional (pt-BR). Sem rastreamento, sem imagens
 * externas; cada mensagem tem versão em texto puro.
 */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], action: { label: string; url: string }, footer: string): string {
  const url = escapeHtml(action.url);
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f1ea;font-family:Arial,Helvetica,sans-serif;color:#121512">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:22px;font-weight:800;letter-spacing:-0.5px">VIVA</p>
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`).join("")}
<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#c8f24e;color:#121512;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#474e47">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
<p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${url}" style="color:#456200">${url}</a></p>
<p style="margin:0;font-size:13px;color:#646b63">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "olá";

export function resetPasswordEmail(params: { name: string; url: string; validMinutes: number }): EmailContent {
  const greeting = `Olá, ${firstName(params.name)}!`;
  const body = `Recebemos um pedido para redefinir a senha da sua conta no VIVA. O link vale por ${params.validMinutes} minutos e só pode ser usado uma vez.`;
  const footer = "Se não foi você, ignore este e-mail: sua senha continua a mesma.";
  return {
    subject: "Redefinir sua senha do VIVA",
    text: `${greeting}\n\n${body}\n\nRedefinir senha: ${params.url}\n\n${footer}`,
    html: layout("Redefinir senha", [greeting, body], { label: "Redefinir senha", url: params.url }, footer),
  };
}

export function verifyEmailEmail(params: { name: string; url: string }): EmailContent {
  const greeting = `Olá, ${firstName(params.name)}!`;
  const body = "Confirme que este e-mail é seu. Assim você consegue recuperar a conta se esquecer a senha.";
  const footer = "Se você não criou uma conta no VIVA, ignore este e-mail.";
  return {
    subject: "Confirme seu e-mail no VIVA",
    text: `${greeting}\n\n${body}\n\nConfirmar e-mail: ${params.url}\n\n${footer}`,
    html: layout("Confirme seu e-mail", [greeting, body], { label: "Confirmar e-mail", url: params.url }, footer),
  };
}
