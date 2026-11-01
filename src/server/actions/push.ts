"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-types";
import { safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { requireUser } from "../session";
import { vapidSettings } from "../push/send";
import { notifyUser, removePushSubscription, savePushSubscription } from "../services/push";

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function subscribePushAction(subscription: unknown, userAgent: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    if (!vapidSettings().configured) throw new UserFacingError("As notificações não estão configuradas nesta instalação.");
    await consumeRateLimit(`push-sub:${user.id}`, 10, 60 * 10);
    const parsed = subscriptionSchema.safeParse(subscription);
    if (!parsed.success) throw new UserFacingError("Não foi possível registrar este aparelho.");
    await savePushSubscription(user.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : null,
    });
    return { ok: true, message: "Notificações ativadas neste aparelho." };
  });
}

export async function unsubscribePushAction(endpoint: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    if (typeof endpoint !== "string" || endpoint.length > 1000) throw new UserFacingError("Aparelho inválido.");
    await removePushSubscription(user.id, endpoint);
    return { ok: true, message: "Notificações desativadas neste aparelho." };
  });
}

export async function testPushAction(): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    await consumeRateLimit(`push-test:${user.id}`, 3, 60 * 10);
    const { sent } = await notifyUser(user.id, {
      title: "VIVA",
      body: "Notificações funcionando. Os lembretes chegam só para o que você ativou.",
      url: "/inicio",
      tag: "teste",
    });
    if (!sent) throw new UserFacingError("Nenhum aparelho recebeu a notificação. Ative novamente neste aparelho.");
    return { ok: true, message: "Notificação de teste enviada." };
  });
}
