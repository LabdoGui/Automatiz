import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyPopper, Trash2 } from "lucide-react";
import { formatDateLong, formatDec, formatInt } from "@/domain/format";
import { localDate, localTime } from "@/domain/dates";
import { maxWeight, sessionDurationSeconds, setVolume } from "@/domain/training/training";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { NotFoundError } from "@/server/action-utils";
import { getSession } from "@/server/services/training";
import { deleteSessionAction } from "@/server/actions/training";

export const metadata: Metadata = { title: "Treino registrado" };

export default async function SessionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ concluido?: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { tz } = clockFor(settings);
  const { id } = await params;
  const { concluido } = await searchParams;
  let s;
  try {
    s = await getSession(user.id, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (s.status !== "COMPLETED") notFound();
  const sets = s.exercises.flatMap((e) => e.sets);
  const minutes = Math.round(sessionDurationSeconds(s) / 60);

  return (
    <>
      <PageHeader
        backHref="/treino/historico"
        eyebrow={`${formatDateLong(localDate(s.startedAt, tz))} · ${localTime(s.startedAt, tz)}`}
        title={s.title}
      />
      {concluido && (
        <div className="mb-6 flex animate-pop items-center gap-3 rounded-[2rem] bg-lime p-5 text-lime-ink">
          <PartyPopper className="h-8 w-8 shrink-0" aria-hidden />
          <p className="font-display text-lg font-bold">Treino registrado. Descanse e hidrate-se — a recuperação faz parte do processo.</p>
        </div>
      )}
      <dl className="mb-8 grid grid-cols-3 gap-3">
        {[
          ["Duração", `${minutes} min`],
          ["Séries", formatInt(sets.filter((x) => x.completed).length)],
          ["Volume", `${formatInt(setVolume(sets))} kg`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-line p-4">
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      {s.discomfort && (
        <FormMessage tone="warning" className="mb-6">
          Você relatou desconforto neste treino. No próximo, mantenha ou reduza a carga e procure orientação se a dor persistir.
        </FormMessage>
      )}
      <ol className="flex flex-col gap-4">
        {s.exercises.map((e) => (
          <li key={e.id} className="rounded-3xl border border-line p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <Link href={`/treino/exercicios/${e.exercise.slug}`} className="font-bold hover:underline">
                {e.exercise.name}
              </Link>
              <span className="text-sm text-ink-2 tabular">máx. {maxWeight(e.sets) !== null ? `${formatDec(maxWeight(e.sets)!)} kg` : "—"}</span>
            </div>
            <table className="w-full text-sm tabular">
              <caption className="sr-only">Séries de {e.exercise.name}</caption>
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="py-1">Série</th>
                  <th scope="col" className="py-1">Reps</th>
                  <th scope="col" className="py-1">Carga</th>
                  <th scope="col" className="py-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {e.sets.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className="py-1.5">{x.setNumber}</td>
                    <td className="py-1.5">{x.reps ?? "—"}</td>
                    <td className="py-1.5">{x.weightKg !== null ? `${formatDec(x.weightKg)} kg` : "—"}</td>
                    <td className="py-1.5 text-right">{x.completed ? "feita" : "não feita"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {e.notes && <p className="mt-2 text-sm text-ink-2">{e.notes}</p>}
          </li>
        ))}
      </ol>
      {(s.notes || s.perceivedEffort) && (
        <section className="mt-6 rounded-3xl bg-surface-2 p-4 text-sm">
          {s.perceivedEffort && <p>Esforço percebido: <strong>{s.perceivedEffort}/10</strong></p>}
          {s.notes && <p className="mt-1 whitespace-pre-line">{s.notes}</p>}
        </section>
      )}
      <div className="mt-8">
        <Dialog title="Excluir este treino?" description="O registro sai do histórico e dos gráficos. O XP já ganho é mantido." trigger={<><Trash2 className="h-4 w-4" aria-hidden /> Excluir registro</>} triggerVariant="danger" triggerSize="sm">
          <ActionForm action={deleteSessionAction}>
            <input type="hidden" name="sessionId" value={s.id} />
            <SubmitButton variant="danger" block>
              Excluir
            </SubmitButton>
          </ActionForm>
        </Dialog>
      </div>
    </>
  );
}
