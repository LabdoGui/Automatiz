"use client";

import { useState } from "react";
import { formatWith, niceTicks, useWidth, type ValueFormat } from "./chart-utils";

export interface Column {
  key: string;
  label: string;
  value: number;
  /** Valor de referência (ex.: orçamento ou meta), desenhado como traço */
  reference?: number | null;
  /** Texto extra no tooltip */
  detail?: string;
}

/**
 * Colunas de série única a partir de zero. Barras ≤ 24 px com ponta
 * arredondada; rótulos só no máximo e no último valor; tooltip por barra.
 */
export function ColumnChart({
  data,
  label,
  unit,
  height = 220,
  format = "compact",
  referenceLabel,
}: {
  data: Column[];
  label: string;
  unit: string;
  height?: number;
  format?: ValueFormat;
  referenceLabel?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const formatValue = (v: number) => formatWith(format, v);
  const [active, setActive] = useState<number | null>(null);
  const m = { top: 22, right: 8, bottom: 28, left: 44 };
  const w = Math.max(200, width);
  const iw = w - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.reference ?? 0)));
  const ticks = niceTicks(0, max, 4);
  const top = ticks[ticks.length - 1];
  const sy = (v: number) => m.top + ih - (v / top) * ih;
  const band = iw / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 56)));
  const hasRef = data.some((d) => d.reference !== null && d.reference !== undefined);

  const bar = (x: number, y: number, bw: number, h: number) => {
    if (h <= 0) return "";
    const r = Math.min(4, h, bw / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z`;
  };

  if (data.length === 0) return null;
  const a = active !== null ? data[active] : null;

  return (
    <figure className="m-0 min-w-0">
      {hasRef && referenceLabel && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} aria-hidden /> {label}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 rounded-full bg-ink-2" aria-hidden /> {referenceLabel}
          </span>
        </div>
      )}
      <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
        <svg width={w} height={height} role="img" aria-label={label} className="absolute inset-0 block">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + iw} y1={sy(v)} y2={sy(v)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={m.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)" className="tabular">
                {formatValue(v)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = m.left + band * i + band / 2;
            const y = sy(d.value);
            const h = m.top + ih - y;
            const showLabel = d.value > 0 && (i === maxIndex || i === data.length - 1);
            return (
              <g key={d.key}>
                <path d={bar(cx - barW / 2, y, barW, h)} fill="var(--chart-1)" opacity={active === null || active === i ? 1 : 0.55} />
                {d.reference !== null && d.reference !== undefined && (
                  <line x1={cx - barW / 2 - 4} x2={cx + barW / 2 + 4} y1={sy(d.reference)} y2={sy(d.reference)} stroke="var(--ink-2)" strokeWidth={2} strokeLinecap="round" />
                )}
                {showLabel && (
                  <text x={cx} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--ink)" className="tabular">
                    {formatValue(d.value)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                    {d.label}
                  </text>
                )}
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={ih}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${formatValue(d.value)} ${unit}${d.reference != null ? `, ${referenceLabel ?? "referência"} ${formatValue(d.reference)}` : ""}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-[var(--lime)]"
                />
              </g>
            );
          })}
        </svg>
        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm shadow-lift"
            style={{ left: Math.min(Math.max(m.left + band * active + band / 2 - 70, 0), w - 150), minWidth: 140 }}
          >
            <p className="font-display text-base font-bold tabular">
              {formatValue(a.value)} {unit}
            </p>
            <p className="text-xs text-ink-2">{a.label}</p>
            {a.reference != null && (
              <p className="text-xs text-ink-2">
                {referenceLabel}: {formatValue(a.reference)}
              </p>
            )}
            {a.detail && <p className="text-xs text-ink-3">{a.detail}</p>}
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-ink-2">Ver tabela</summary>
        <table className="mt-2 w-full text-left text-sm tabular">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="py-1">Período</th>
              <th scope="col" className="py-1 text-right">{unit}</th>
              {hasRef && <th scope="col" className="py-1 text-right">{referenceLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{formatValue(d.value)}</td>
                {hasRef && <td className="py-1 text-right">{d.reference != null ? formatValue(d.reference) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
