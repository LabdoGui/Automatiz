import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MuscleGroup } from "@/generated/prisma/client";
import { MUSCLE_GROUP_LABEL, MUSCLE_GROUPS } from "@/domain/training/training";
import { equipmentText } from "@/components/training/equipment";
import { DIFFICULTY_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { BodyMap } from "@/components/training/body-map";
import { cn } from "@/components/ui/cn";
import { requireOnboardedUser } from "@/server/session";
import { exerciseCatalog } from "@/server/services/training";

export const metadata: Metadata = { title: "Exercícios" };

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  await requireOnboardedUser();
  const { grupo } = await searchParams;
  const group = MUSCLE_GROUPS.includes(grupo as MuscleGroup) ? (grupo as MuscleGroup) : null;
  const exercises = await exerciseCatalog(group ?? undefined);
  const groups = group ? [group] : MUSCLE_GROUPS;

  return (
    <>
      <PageHeader backHref="/treino" eyebrow="Treino" title="Exercícios" description="Instruções passo a passo, erros comuns e alternativas. Sem vídeos: conteúdo em texto, revisado para iniciantes." />
      <nav aria-label="Grupos musculares" className="relative -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        <Link href="/treino/exercicios" aria-current={!group ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", !group ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>
          Todos
        </Link>
        {MUSCLE_GROUPS.map((g) => (
          <Link key={g} href={`/treino/exercicios?grupo=${g}`} aria-current={group === g ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", group === g ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>
            {MUSCLE_GROUP_LABEL[g]}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-10">
        {groups.map((g) => {
          const list = exercises.filter((e) => e.primaryGroup === g);
          if (list.length === 0) return null;
          return (
            <section key={g} aria-labelledby={`g-${g}`} className="grid gap-4 sm:grid-cols-[9rem_1fr]">
              <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                <BodyMap group={g} className="h-24 sm:h-32" />
                <h2 id={`g-${g}`} className="text-xl font-extrabold">
                  {MUSCLE_GROUP_LABEL[g]}
                </h2>
              </div>
              <ul className="divide-y divide-line rounded-3xl border border-line">
                {list.map((e) => (
                  <li key={e.id}>
                    <Link href={`/treino/exercicios/${e.slug}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{e.name}</p>
                        <p className="text-sm text-ink-2">{equipmentText(e.equipment)}</p>
                      </div>
                      <Badge tone={e.difficulty === "BEGINNER" ? "lime" : e.difficulty === "INTERMEDIATE" ? "sky" : "coral"}>{DIFFICULTY_LABEL[e.difficulty]}</Badge>
                      <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
