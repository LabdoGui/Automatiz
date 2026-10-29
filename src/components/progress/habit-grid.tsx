"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleHabitAction } from "@/server/actions/progress";
import { weekdayIndex, WEEKDAY_SHORT } from "@/domain/dates";
import { DynamicIcon } from "../ui/dynamic-icon";
import { useFeedback } from "../ui/feedback";
import { cn } from "../ui/cn";

export interface HabitRow {
  id: string;
  name: string;
  icon: string;
  checked: string[];
}

function HabitLine({ habit, days }: { habit: HabitRow; days: string[] }) {
  const [checked, toggle] = useOptimistic(new Set(habit.checked), (state: Set<string>, date: string) => {
    const next = new Set(state);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    return next;
  });
  const [, start] = useTransition();
  const { toast, celebrate } = useFeedback();
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2 pr-2 text-left font-semibold">
        <span className="flex items-center gap-2">
          <DynamicIcon name={habit.icon} className="h-4 w-4 shrink-0 text-lime-text" />
          <span className="line-clamp-2">{habit.name}</span>
        </span>
      </th>
      {days.map((d) => {
        const on = checked.has(d);
        return (
          <td key={d} className="py-2 text-center">
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={`${habit.name} em ${WEEKDAY_SHORT[weekdayIndex(d)]} ${d.slice(8)}`}
              onClick={() =>
                start(async () => {
                  toggle(d);
                  const res = await toggleHabitAction(habit.id, d);
                  if (!res.ok) toast(res.error, "error");
                  else if (res.celebrations?.length) celebrate(res.celebrations);
                })
              }
              className={cn(
                "mx-auto grid h-10 w-10 place-items-center rounded-xl border-2 transition-colors",
                on ? "border-lime bg-lime text-lime-ink" : "border-line text-transparent hover:border-lime",
              )}
            >
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
            </button>
          </td>
        );
      })}
    </tr>
  );
}

/** Grade de hábitos dos últimos 7 dias. Sem sequências que punem: cada dia vale por si. */
export function HabitGrid({ habits, days, today }: { habits: HabitRow[]; days: string[]; today: string }) {
  return (
    <div className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[30rem] text-sm">
        <caption className="sr-only">Hábitos dos últimos 7 dias</caption>
        <thead>
          <tr className="text-xs text-ink-3">
            <th scope="col" className="w-[38%] py-1 text-left font-semibold">
              Hábito
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className={cn("py-1 font-semibold", d === today && "text-lime-text")}>
                {WEEKDAY_SHORT[weekdayIndex(d)]}
                <span className="block font-normal tabular">{d.slice(8)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => (
            <HabitLine key={h.id} habit={h} days={days} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
