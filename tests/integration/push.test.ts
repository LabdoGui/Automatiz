import { execFileSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, Agent, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpush from "web-push";
import { db } from "@/server/db";
import { runReminderPush } from "@/server/services/push";
import { GET as cronGET } from "@/app/api/cron/lembretes/route";
import { cleanupTestUsers, createTestUser } from "../support/factories";

// Serviço de push local (HTTPS) que registra o que recebe.
let server: Server;
let agent: Agent;
let base: string;
let nextStatus = 201;
const received: { url: string; headers: Record<string, string | string[] | undefined>; bytes: number }[] = [];

beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "viva-push-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem")], { stdio: "pipe" });
  const cert = readFileSync(path.join(dir, "cert.pem"));
  server = createServer({ key: readFileSync(path.join(dir, "key.pem")), cert }, (req, res) => {
    let bytes = 0;
    req.on("data", (c: Buffer) => (bytes += c.length));
    req.on("end", () => {
      received.push({ url: req.url ?? "", headers: req.headers, bytes });
      res.writeHead(nextStatus);
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `https://localhost:${(server.address() as AddressInfo).port}`;
  agent = new Agent({ ca: cert }); // confia só no certificado deste teste
  const keys = webpush.generateVAPIDKeys();
  Object.assign(process.env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:teste@viva.invalid" });
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  for (const k of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET"]) delete process.env[k];
  await cleanupTestUsers();
});

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
}

// 15:00 em São Paulo (UTC-3) — dentro do horário acordado padrão
const AT_15H = new Date("2026-11-03T18:00:00Z");
const AT_23H = new Date("2026-11-04T02:00:00Z");

async function userWithWaterReminder() {
  const user = await createTestUser();
  await db.userSettings.update({ where: { userId: user.id }, data: { notifyWater: true } });
  await db.profile.update({ where: { userId: user.id }, data: { trackWater: true, waterGoalMl: 2000, wakeTime: "07:00", sleepTime: "22:00" } });
  return user;
}

describe("notificações push (Web Push + VAPID)", () => {
  it("envia o lembrete criptografado e assinado, uma única vez por dia", async () => {
    const user = await userWithWaterReminder();
    await db.pushSubscription.create({ data: { userId: user.id, endpoint: `${base}/push/${user.id}`, ...browserKeys() } });

    const before = received.length;
    const first = await runReminderPush(AT_15H, { agent });
    const mine = received.slice(before).filter((r) => r.url === `/push/${user.id}`);
    expect(mine).toHaveLength(1);
    expect(mine[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(String(mine[0].headers.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(mine[0].headers.ttl).toBe("3600");
    expect(mine[0].bytes).toBeGreaterThan(100);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(await db.pushDelivery.count({ where: { userId: user.id, key: "water:2026-11-03" } })).toBe(1);

    const again = received.length;
    await runReminderPush(AT_15H, { agent });
    expect(received.slice(again).filter((r) => r.url === `/push/${user.id}`)).toHaveLength(0);
  });

  it("não envia fora do horário acordado", async () => {
    const user = await userWithWaterReminder();
    await db.pushSubscription.create({ data: { userId: user.id, endpoint: `${base}/push/noite-${user.id}`, ...browserKeys() } });
    const before = received.length;
    await runReminderPush(AT_23H, { agent });
    expect(received.slice(before).filter((r) => r.url === `/push/noite-${user.id}`)).toHaveLength(0);
  });

  it("remove inscrições que o serviço de push informa como expiradas (410)", async () => {
    const user = await userWithWaterReminder();
    await db.pushSubscription.create({ data: { userId: user.id, endpoint: `${base}/push/expirada-${user.id}`, ...browserKeys() } });
    nextStatus = 410;
    try {
      await runReminderPush(AT_15H, { agent });
    } finally {
      nextStatus = 201;
    }
    expect(await db.pushSubscription.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rota agendada exige o segredo", async () => {
    delete process.env.CRON_SECRET;
    expect((await cronGET(new Request("http://localhost/api/cron/lembretes"))).status).toBe(503);
    process.env.CRON_SECRET = "segredo-de-teste";
    expect((await cronGET(new Request("http://localhost/api/cron/lembretes", { headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });
});
