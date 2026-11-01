import { createHash, timingSafeEqual } from "node:crypto";
import { vapidSettings } from "@/server/push/send";
import { runReminderPush } from "@/server/services/push";

/**
 * Envio agendado dos lembretes por notificação push. Chamado por um
 * agendador (Vercel Cron, GitHub Actions ou cron do servidor) a cada 15 min,
 * com o cabeçalho "Authorization: Bearer <CRON_SECRET>".
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) return Response.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!vapidSettings().configured) return Response.json({ error: "Chaves VAPID não configuradas." }, { status: 503 });
  const summary = await runReminderPush();
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
