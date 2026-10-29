import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekDates, WEEKDAY_LONG, WEEKDAY_SHORT, type ISODate } from "@/domain/dates";
import { formatDateLong } from "@/domain/format";
import { cn } from "../ui/cn";

export function WeekNav({ weekStart, basePath, today }: { weekStart: ISODate; basePath: string; today: ISODate }) {
  const end = addDays(weekStart, 6);
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <Link
        href={`${basePath}?dia=${addDays(weekStart, -7)}`}
        className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-2 hover:bg-surface-2 hover:text-ink"
        aria-label="Semana anterior"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Link>
      <div className="text-center">
        <p className="font-display text-base font-bold">
          {formatDateLong(weekStart)} — {formatDateLong(end)}
        </p>
        {(today < weekStart || today > end) && (
          <Link href={`${basePath}?dia=${today}`} className="text-xs font-semibold text-lime-text hover:underline">
            Voltar para hoje
          </Link>
        )}
      </div>
      <Link
        href={`${basePath}?dia=${addDays(weekStart, 7)}`}
        className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-2 hover:bg-surface-2 hover:text-ink"
        aria-label="Próxima semana"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}

export function WeekStrip({
  weekStart,
  selected,
  today,
  progress,
  basePath,
}: {
  weekStart: ISODate;
  selected: ISODate;
  today: ISODate;
  progress: Record<ISODate, { planned: number; completed: number }>;
  basePath: string;
}) {
  return (
    <nav aria-label="Dias da semana" className="mb-6">
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDates(weekStart).map((date, i) => {
          const p = progress[date] ?? { planned: 0, completed: 0 };
          const ratio = p.planned ? p.completed / p.planned : 0;
          const isSel = date === selected;
          const isToday = date === today;
          return (
            <li key={date}>
              <Link
                href={`${basePath}?dia=${date}`}
                aria-current={isSel ? "date" : undefined}
                aria-label={`${WEEKDAY_LONG[i]}, ${formatDateLong(date)}${isToday ? " (hoje)" : ""}: ${p.completed} de ${p.planned} refeições concluídas`}
                className={cn(
                  "flex min-h-[4.6rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition-colors",
                  isSel ? "border-lime bg-lime text-lime-ink" : "border-line hover:bg-surface-2",
                  !isSel && isToday && "border-ink-3",
                )}
              >
                <span className={cn("text-[0.68rem] font-bold uppercase tracking-wider", isSel ? "text-lime-ink/70" : "text-ink-3")}>
                  {WEEKDAY_SHORT[i]}
                </span>
                <span className="font-display text-xl leading-none font-extrabold tabular">{Number(date.slice(8))}</span>
                <span aria-hidden className={cn("h-1 w-7 overflow-hidden rounded-full", isSel ? "bg-lime-ink/20" : "bg-surface-3")}>
                  <span className={cn("block h-full rounded-full", isSel ? "bg-lime-ink" : "bg-lime")} style={{ width: `${ratio * 100}%` }} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
