import { weekdayIndex, WEEKDAY_SHORT } from "@/domain/dates";
import { formatDayMonth } from "@/domain/format";

export interface HeatDay {
  date: string;
  /** null = nada planejado nesse dia */
  ratio: number | null;
  detail: string;
}

const STEPS = ["var(--chart-seq-1)", "var(--chart-seq-2)", "var(--chart-seq-3)", "var(--chart-seq-4)"];

function colorFor(ratio: number | null): string {
  if (ratio === null) return "transparent";
  if (ratio <= 0) return "var(--surface-3)";
  if (ratio < 0.34) return STEPS[0];
  if (ratio < 0.67) return STEPS[1];
  if (ratio < 1) return STEPS[2];
  return STEPS[3];
}

/**
 * Calendário de consistência (sequencial, uma matiz). Cada coluna é uma
 * semana; linhas de segunda a domingo. Cada célula é focável e descrita.
 */
export function HeatCalendar({ days, label }: { days: HeatDay[]; label: string }) {
  if (days.length === 0) return null;
  const firstIdx = weekdayIndex(days[0].date);
  const cells: (HeatDay | null)[] = [...Array.from({ length: firstIdx }, () => null), ...days];
  const weeks: (HeatDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <figure className="m-0">
      <div className="relative flex gap-2 overflow-x-auto pb-2" role="group" aria-label={label} tabIndex={0}>
        <div className="flex shrink-0 flex-col gap-[3px] pt-0 text-[10px] leading-[18px] text-ink-3" aria-hidden>
          {WEEKDAY_SHORT.map((d, i) => (
            <span key={d} className="h-[18px]">
              {i % 2 === 0 ? d : ""}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const d = week[di];
              if (!d) return <span key={di} className="h-[18px] w-[18px]" aria-hidden />;
              return (
                <span
                  key={di}
                  tabIndex={0}
                  role="img"
                  title={`${formatDayMonth(d.date)}: ${d.detail}`}
                  aria-label={`${formatDayMonth(d.date)}: ${d.detail}`}
                  className="h-[18px] w-[18px] rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  style={{
                    background: colorFor(d.ratio),
                    boxShadow: d.ratio === null ? "inset 0 0 0 1px var(--line)" : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <span>Menos</span>
        <span className="h-3 w-3 rounded-[3px] bg-surface-3" aria-hidden />
        {STEPS.map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} aria-hidden />
        ))}
        <span>Mais refeições concluídas</span>
        <span className="ml-2 inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px]" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} aria-hidden /> sem plano
        </span>
      </figcaption>
    </figure>
  );
}
