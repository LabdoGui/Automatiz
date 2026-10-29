import "server-only";
import { db } from "./db";

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Muitas solicitações em pouco tempo. Tente novamente em instantes.");
  }
}

/**
 * Limite atômico por chave em janela fixa (consulta única com UPSERT).
 * Retorna o número de usos na janela atual ou lança RateLimitError.
 */
export async function consumeRateLimit(key: string, max: number, windowSeconds: number): Promise<number> {
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "action_rate_limit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "action_rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int)
        THEN 1 ELSE "action_rate_limit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "action_rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int)
        THEN now() ELSE "action_rate_limit"."windowStart" END
    RETURNING "count", "windowStart"`;
  const row = rows[0];
  if (row.count > max) {
    const elapsed = (Date.now() - new Date(row.windowStart).getTime()) / 1000;
    throw new RateLimitError(Math.max(1, Math.ceil(windowSeconds - elapsed)));
  }
  return row.count;
}
