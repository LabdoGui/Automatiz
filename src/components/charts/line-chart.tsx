"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatWith, niceTicks, useWidth, type ValueFormat } from "./chart-utils";

export interface LinePoint {
  /** Data ISO (AAAA-MM-DD) */
  x: string;
  y: number;
}

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

/**
 * Linha de série única ao longo do tempo (eixo X por data real).
 * Crosshair + tooltip no ponteiro e no teclado; tabela equivalente abaixo.
 */
export function LineChart({
  points,
  label,
  unit,
  height = 220,
  format = "compact",
  zeroBased = false,
}: {
  points: LinePoint[];
  label: string;
  unit: string;
  height?: number;
  format?: ValueFormat;
  zeroBased?: boolean;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const formatValue = (v: number) => formatWith(format, v);
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();
  const sorted = [...points].sort((a, b) => a.x.localeCompare(b.x));
  const m = { top: 16, right: 56, bottom: 28, left: 44 };
  const w = Math.max(200, width);
  const iw = w - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const ys = sorted.map((p) => p.y);
  const minY = zeroBased ? 0 : Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = zeroBased ? 0 : (maxY - minY) * 0.15 || Math.abs(maxY) * 0.05 || 1;
  const ticks = niceTicks(minY - pad, maxY + pad, 4);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const t = sorted.map((p) => new Date(`${p.x}T00:00:00Z`).getTime());
  const t0 = Math.min(...t);
  const t1 = Math.max(...t);
  const sx = (ms: number) => m.left + (t1 === t0 ? iw / 2 : ((ms - t0) / (t1 - t0)) * iw);
  const sy = (v: number) => m.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const coords = sorted.map((p, i) => ({ px: sx(t[i]), py: sy(p.y), p }));
  const path = coords.map((c, i) => `${i ? "L" : "M"}${c.px.toFixed(1)},${c.py.toFixed(1)}`).join("");
  const area = coords.length > 1 ? `${path}L${coords.at(-1)!.px},${m.top + ih}L${coords[0].px},${m.top + ih}Z` : "";
  const last = coords.at(-1);
  const xLabels = coords.length <= 1 ? coords : [coords[0], coords.at(-1)!];

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.px - x) < Math.abs(coords[best].px - x)) best = i;
    });
    setActive(best);
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight") setActive((a) => Math.min((a ?? -1) + 1, coords.length - 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max((a ?? coords.length) - 1, 0));
    else if (e.key === "Escape") setActive(null);
  }

  if (sorted.length === 0) return null;
  const a = active !== null ? coords[active] : null;

  return (
    <figure className="m-0 min-w-0">
      <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={`${label}. Use as setas para navegar pelos pontos.`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(coords.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="absolute inset-0 block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-lime"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + iw} y1={sy(v)} y2={sy(v)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={m.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)" className="tabular">
                {formatValue(v)}
              </text>
            </g>
          ))}
          {area && <path d={area} fill={`url(#${gradientId})`} />}
          <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {coords.length <= 31 &&
            coords.map((c, i) => <circle key={i} cx={c.px} cy={c.py} r={3} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />)}
          {last && (
            <>
              <circle cx={last.px} cy={last.py} r={4.5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
              <text x={last.px + 9} y={last.py} dy="0.32em" fontSize="12" fontWeight={700} fill="var(--ink)" className="tabular">
                {formatValue(last.p.y)}
              </text>
            </>
          )}
          {xLabels.map((c, i) => (
            <text key={i} x={c.px} y={height - 8} textAnchor={i === 0 && xLabels.length > 1 ? "start" : "end"} fontSize="11" fill="var(--ink-3)">
              {fmtDate(c.p.x)}
            </text>
          ))}
          {a && (
            <g pointerEvents="none">
              <line x1={a.px} x2={a.px} y1={m.top} y2={m.top + ih} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={a.px} cy={a.py} r={5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {a && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm shadow-lift"
            style={{ left: Math.min(Math.max(a.px - 60, 0), w - 140), minWidth: 120 }}
          >
            <p className="font-display text-base font-bold tabular">
              {formatValue(a.p.y)} {unit}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: "var(--chart-1)" }} aria-hidden />
              {fmtDate(a.p.x)}
            </p>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-ink-2">Ver tabela</summary>
        <table className="mt-2 w-full text-left text-sm tabular">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="py-1">Data</th>
              <th scope="col" className="py-1 text-right">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={`${p.x}-${i}`} className="border-t border-line">
                <td className="py-1">{fmtDate(p.x)}</td>
                <td className="py-1 text-right">{formatValue(p.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
