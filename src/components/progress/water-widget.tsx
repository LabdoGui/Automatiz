"use client";

import { useOptimistic, useTransition } from "react";
import { Droplets, Undo2 } from "lucide-react";
import { addWaterAction, undoWaterAction } from "@/server/actions/progress";
import { formatInt } from "@/domain/format";
import { useFeedback } from "../ui/feedback";

/** Copo de água com preenchimento proporcional e botões de registro rápido. */
export function WaterWidget({ totalMl, goalMl }: { totalMl: number; goalMl: number }) {
  const [optimistic, add] = useOptimistic(totalMl, (state: number, delta: number) => Math.max(0, state + delta));
  const [pending, start] = useTransition();
  const { toast, celebrate } = useFeedback();
  const ratio = Math.min(1, optimistic / goalMl);

  const register = (ml: number) =>
    start(async () => {
      add(ml);
      const res = await addWaterAction(ml);
      if (!res.ok) toast(res.error, "error");
      else {
        if (res.message) toast(res.message);
        if (res.celebrations?.length) celebrate(res.celebrations);
      }
    });

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-28 w-20 shrink-0 overflow-hidden rounded-b-[1.4rem] rounded-t-md border-2 border-sky/60 bg-sky-soft"
        role="img"
        aria-label={`${formatInt(optimistic)} de ${formatInt(goalMl)} ml de água hoje`}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-sky/80 transition-[height] duration-700 ease-out"
          style={{ height: `${ratio * 100}%` }}
        >
          <svg viewBox="0 0 80 8" preserveAspectRatio="none" className="absolute -top-2 left-0 h-2 w-full fill-sky/80" aria-hidden>
            <path d="M0 4 Q10 0 20 4 T40 4 T60 4 T80 4 V8 H0Z" />
          </svg>
        </div>
        <Droplets className="absolute top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-sky-text" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl font-extrabold tabular">
          {formatInt(optimistic)}
          <span className="text-base font-semibold text-ink-3"> / {formatInt(goalMl)} ml</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[200, 300, 500].map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={pending}
              onClick={() => register(ml)}
              className="h-10 rounded-full bg-sky-soft px-3.5 text-sm font-semibold text-sky-text transition-transform active:scale-95 disabled:opacity-60"
            >
              +{ml} ml
            </button>
          ))}
          {optimistic > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await undoWaterAction();
                  if (!res.ok) toast(res.error, "error");
                })
              }
              className="grid h-10 w-10 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label="Desfazer último registro de água"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
