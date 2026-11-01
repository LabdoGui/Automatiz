import "server-only";
import type { Agent } from "node:https";
import webpush, { WebPushError } from "web-push";

/**
 * Envio de notificações Web Push com chaves VAPID (gratuito: usa o serviço
 * de push do próprio navegador). Sem as chaves, o recurso fica desativado.
 * Gere as chaves com: npm run push:chaves
 */
export function vapidSettings() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contato@viva.invalid";
  return { configured: Boolean(publicKey && privateKey), publicKey, privateKey, subject };
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type PushResult = "sent" | "gone" | "failed";

/** Envia uma notificação. "gone" indica inscrição expirada/cancelada (deve ser apagada). */
export async function sendPush(sub: StoredSubscription, message: PushMessage, opts: { agent?: Agent } = {}): Promise<PushResult> {
  const s = vapidSettings();
  if (!s.configured) return "failed";
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(message), {
      vapidDetails: { subject: s.subject, publicKey: s.publicKey, privateKey: s.privateKey },
      TTL: 60 * 60,
      urgency: "normal",
      topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
      timeout: 10_000,
      agent: opts.agent,
    });
    return "sent";
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return "gone";
    const status = error instanceof WebPushError ? error.statusCode : undefined;
    console.error(`[viva:push] falha no envio${status ? ` (status ${status})` : ""}`);
    return "failed";
  }
}
