import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { UserFacingError } from "../action-utils";
import type { EmailContent } from "./templates";

/**
 * Envio de e-mail por SMTP — funciona com qualquer provedor (Brevo, Resend,
 * Amazon SES, Gmail com senha de app…). Sem SMTP configurado, recuperação de
 * senha e verificação de e-mail ficam indisponíveis (nada é simulado).
 * Em desenvolvimento, EMAIL_TRANSPORT=console mostra a mensagem no terminal.
 */
export type EmailSettings =
  | { configured: false }
  | { configured: true; transport: "console"; from: string }
  | { configured: true; transport: "smtp"; from: string; host: string; port: number; secure: boolean; user?: string; pass?: string };

export function emailSettings(): EmailSettings {
  const from = process.env.EMAIL_FROM?.trim() || "";
  if (process.env.EMAIL_TRANSPORT === "console" && process.env.NODE_ENV !== "production") {
    return { configured: true, transport: "console", from: from || "VIVA <nao-responda@localhost>" };
  }
  const host = process.env.SMTP_HOST?.trim();
  if (!host || !from) return { configured: false };
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    configured: true,
    transport: "smtp",
    from,
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASSWORD || undefined,
  };
}

export class EmailDeliveryError extends UserFacingError {
  constructor() {
    super("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.");
  }
}

let transporter: Transporter | null = null;
let transporterKey = "";

function getTransporter(s: Extract<EmailSettings, { transport: "smtp" }>): Transporter {
  const key = `${s.host}:${s.port}:${s.secure}:${s.user ?? ""}`;
  if (!transporter || key !== transporterKey) {
    transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: s.user ? { user: s.user, pass: s.pass ?? "" } : undefined,
      // Exige TLS na porta 587 (STARTTLS); em 465 a conexão já é TLS.
      requireTLS: !s.secure && process.env.SMTP_REQUIRE_TLS !== "false",
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    transporterKey = key;
  }
  return transporter;
}

/** Mostra só o começo do endereço nos logs (LGPD). */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain ?? "?"}`;
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const s = emailSettings();
  if (!s.configured) throw new UserFacingError("O envio de e-mails não está configurado nesta instalação.");
  if (s.transport === "console") {
    console.info(`[viva:email] (desenvolvimento) para ${maskEmail(to)} — ${content.subject}\n${content.text}\n`);
    return;
  }
  try {
    await getTransporter(s).sendMail({ from: s.from, to, subject: content.subject, text: content.text, html: content.html });
  } catch (error) {
    const code = (error as { code?: string; responseCode?: number })?.code ?? (error as { responseCode?: number })?.responseCode;
    console.error(`[viva:email] falha no envio${code ? ` (${code})` : ""}`);
    throw new EmailDeliveryError();
  }
}

export function appUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
