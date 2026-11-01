import "server-only";
import type { Agent } from "node:https";
import { Prisma } from "@/generated/prisma/client";
import { localDate } from "@/domain/dates";
import { isWithinActiveHours, pushPayload } from "@/domain/gamification/reminders";
import { db } from "../db";
import { userTimezone } from "../session";
import { sendPush, type PushMessage, type PushResult } from "../push/send";
import { remindersFor } from "./reminders";

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const MAX_PER_RUN_PER_USER = 2;

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
) {
  const existing = await db.pushSubscription.findUnique({ where: { endpoint: sub.endpoint } });
  if (!existing) {
    const count = await db.pushSubscription.count({ where: { userId } });
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
      // Mantém os aparelhos mais recentes.
      const oldest = await db.pushSubscription.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
      if (oldest) await db.pushSubscription.delete({ where: { id: oldest.id } });
    }
  }
  // O endpoint é único: se o aparelho trocou de conta, a inscrição passa para a conta atual.
  return db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, ...sub },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent: sub.userAgent, failures: 0 },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const { count } = await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return count;
}

export async function countPushSubscriptions(userId: string) {
  return db.pushSubscription.count({ where: { userId } });
}

type Sender = (sub: { endpoint: string; p256dh: string; auth: string }, message: PushMessage) => Promise<PushResult>;

/** Envia uma mensagem para todos os aparelhos da pessoa; remove inscrições expiradas. */
export async function notifyUser(userId: string, message: PushMessage, send: Sender = sendPush) {
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let removed = 0;
  for (const sub of subs) {
    const result = await send(sub, message);
    if (result === "sent") {
      sent++;
      await db.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date(), failures: 0 } });
    } else if (result === "gone" || sub.failures >= 9) {
      removed++;
      await db.pushSubscription.delete({ where: { id: sub.id } });
    } else {
      await db.pushSubscription.update({ where: { id: sub.id }, data: { failures: { increment: 1 } } });
    }
  }
  return { sent, removed };
}

/**
 * Rodada agendada: para cada pessoa com notificações ativas, envia os
 * lembretes do momento, só no horário acordado e no máximo uma vez por dia
 * por lembrete.
 */
export async function runReminderPush(now: Date = new Date(), opts: { agent?: Agent } = {}) {
  const send: Sender = (sub, message) => sendPush(sub, message, { agent: opts.agent });
  const users = await db.user.findMany({
    where: {
      pushSubscriptions: { some: {} },
      settings: { OR: [{ notifyMeals: true }, { notifyWater: true }, { notifyWorkouts: true }, { notifyChallenges: true }] },
    },
    select: { id: true, settings: { select: { timezone: true } } },
  });
  const summary = { users: users.length, notified: 0, sent: 0, removed: 0, skippedQuietHours: 0 };
  for (const user of users) {
    const { reminders, time, wake, sleep } = await remindersFor(user.id, now);
    if (!isWithinActiveHours(time, wake, sleep)) {
      summary.skippedQuietHours++;
      continue;
    }
    const today = localDate(now, userTimezone(user.settings));
    let delivered = 0;
    for (const reminder of reminders) {
      if (delivered >= MAX_PER_RUN_PER_USER) break;
      try {
        await db.pushDelivery.create({ data: { userId: user.id, key: `${reminder.key}:${today}` } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue; // já enviado hoje
        throw error;
      }
      const result = await notifyUser(user.id, pushPayload(reminder), send);
      summary.sent += result.sent;
      summary.removed += result.removed;
      delivered++;
    }
    if (delivered) summary.notified++;
  }
  return summary;
}
