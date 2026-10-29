import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { consumeRateLimit, RateLimitError } from "@/server/rate-limit";
import { exportUserData } from "@/server/services/account";

/** Download de todos os dados do usuário (LGPD — acesso e portabilidade). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    await consumeRateLimit(`export:${user.id}`, 5, 60 * 60);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const data = await exportUserData(user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="viva-meus-dados-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
