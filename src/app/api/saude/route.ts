import { db } from "@/server/db";

/** Verificação de saúde para orquestradores e monitoramento (sem dados pessoais). */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[viva:saude] banco indisponível");
    return Response.json({ status: "erro", database: "indisponível" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
