import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/session";
import { consumeRateLimit, RateLimitError } from "@/server/rate-limit";
import { foodLabel, searchFoods, STATE_LABEL } from "@/server/services/foods";
import { plannerContext } from "@/server/services/planner";
import { foodConflicts } from "@/domain/restrictions/engine";

/** Busca de alimentos para os campos de seleção (somente usuário autenticado). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    await consumeRateLimit(`food-search:${user.id}`, 120, 60);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const [foods, ctx] = await Promise.all([searchFoods(user.id, q, 20), plannerContext(user.id)]);
  const results = foods.map((f) => {
    const conflicts = foodConflicts(f, ctx.rules);
    return {
      id: f.id,
      label: foodLabel(f),
      name: f.name,
      state: STATE_LABEL[f.state],
      kcal: f.kcal,
      proteinG: f.proteinG,
      incomplete: f.missingFields.length > 0,
      reviewed: f.allergenReviewed,
      own: f.ownerId !== null,
      conflicts: conflicts.map((c) => ({ level: c.level, label: c.label })),
    };
  });
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
