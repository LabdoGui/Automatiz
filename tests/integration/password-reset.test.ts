import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { findLink, startSmtpSink } from "../support/smtp-sink";
import { cleanupTestUsers, createTestUser } from "../support/factories";

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let auth: typeof import("@/server/auth").auth;

beforeAll(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(sink.port),
    SMTP_SECURE: "false",
    SMTP_REQUIRE_TLS: "false",
    EMAIL_FROM: "VIVA <nao-responda@teste.viva.invalid>",
    BETTER_AUTH_URL: "http://localhost:3100",
  });
  vi.resetModules();
  auth = (await import("@/server/auth")).auth;
});

afterAll(async () => {
  await sink.close();
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "EMAIL_FROM"]) delete process.env[k];
  await cleanupTestUsers();
});

async function storedHash(userId: string) {
  const account = await db.account.findFirstOrThrow({ where: { userId, providerId: "credential" } });
  return account.password!;
}

describe("recuperação de senha por e-mail (SMTP)", () => {
  it("envia link de uso único, redefine a senha e encerra sessões", async () => {
    const { id, email } = await createTestUser();
    const { hashPassword } = await import("better-auth/crypto");
    await db.account.create({
      data: { id: `acc_${id}`, userId: id, accountId: id, providerId: "credential", password: await hashPassword("senha-antiga-123") },
    });
    await db.session.create({ data: { id: `ses_${id}`, userId: id, token: `tok_${id}`, expiresAt: new Date(Date.now() + 86_400_000) } });

    const before = sink.mails.length;
    await auth.api.requestPasswordReset({ body: { email } });
    expect(sink.mails.length).toBe(before + 1);
    const mail = sink.mails.at(-1)!;
    expect(mail.to).toEqual([email]);
    expect(mail.raw).toContain("Redefinir sua senha do VIVA");
    const link = findLink(mail.raw, /http:\/\/localhost:3100\/redefinir-senha\?token=[A-Za-z0-9_%-]+/);
    expect(link).not.toBeNull();
    const token = decodeURIComponent(new URL(link!).searchParams.get("token")!);

    await auth.api.resetPassword({ body: { newPassword: "senha-nova-456", token } });
    expect(await verifyPassword({ hash: await storedHash(id), password: "senha-nova-456" })).toBe(true);
    expect(await verifyPassword({ hash: await storedHash(id), password: "senha-antiga-123" })).toBe(false);
    expect(await db.session.count({ where: { userId: id } })).toBe(0);

    // O mesmo link não funciona duas vezes
    await expect(auth.api.resetPassword({ body: { newPassword: "outra-senha-789", token } })).rejects.toThrow();
  });

  it("e-mail não cadastrado: mesma resposta e nenhum envio", async () => {
    const before = sink.mails.length;
    const res = await auth.api.requestPasswordReset({ body: { email: "ninguem@teste.viva.invalid" } });
    expect(res.status).toBe(true);
    expect(sink.mails.length).toBe(before);
  });

  it("token inventado é recusado", async () => {
    await expect(auth.api.resetPassword({ body: { newPassword: "qualquer-senha-1", token: "token-que-nao-existe" } })).rejects.toThrow();
  });

  it("envia confirmação de e-mail com link que marca a conta como verificada", async () => {
    const { id, email } = await createTestUser();
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/perfil?email=verificado" } });
    const link = findLink(sink.mails.at(-1)!.raw, /http:\/\/localhost:3100\/api\/auth\/verify-email\?token=[^\s"<]+/);
    expect(link).not.toBeNull();
    const token = new URL(link!).searchParams.get("token")!;
    await auth.api.verifyEmail({ query: { token } });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(true);
  });
});
