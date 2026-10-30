import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";

export interface CapturedMail {
  from: string;
  to: string[];
  raw: string;
}

/** Servidor SMTP local que apenas guarda as mensagens recebidas (testes). */
export async function startSmtpSink() {
  const mails: CapturedMail[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    logger: false,
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
      stream.on("end", () => {
        mails.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.server.address() as AddressInfo).port;
  return {
    port,
    mails,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Decodifica quoted-printable simples e extrai o primeiro link que casa com o padrão. */
export function findLink(raw: string, pattern: RegExp): string | null {
  const decoded = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  return decoded.match(pattern)?.[0] ?? null;
}
