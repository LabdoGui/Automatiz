import type { Metadata } from "next";
import { addDays, isISODate } from "@/domain/dates";
import { PageHeader } from "@/components/ui/page-header";
import { LogMealForm } from "@/components/planner/log-meal-form";
import { clockFor, requireOnboardedUser } from "@/server/session";

export const metadata: Metadata = { title: "Registrar refeição" };

export default async function LogMealPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const { dia } = await searchParams;
  const date = dia && isISODate(dia) && dia <= today ? dia : today;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        backHref={`/alimentacao?dia=${date}`}
        eyebrow="Fora do planejamento"
        title="Registrar refeição"
        description="Comeu algo diferente do plano? Tudo bem. Registrar ajuda a enxergar a semana — não existe certo ou errado."
      />
      <LogMealForm date={date} maxDate={today} minDate={addDays(today, -60)} />
    </div>
  );
}
