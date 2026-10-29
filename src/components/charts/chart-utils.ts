"use client";

import { useEffect, useRef, useState } from "react";

/** Largura real do contêiner (gráficos desenhados em pixels, sem escalar texto). */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) {
        setWidth(w);
        setMeasured(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width, measured };
}

/** Ticks "redondos" para um intervalo. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export type ValueFormat = "int" | "dec" | "brl" | "compact";

/** Formatos serializáveis (gráficos recebem o nome do formato, não uma função). */
export function formatWith(format: ValueFormat, v: number): string {
  switch (format) {
    case "int":
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
    case "dec":
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v);
    case "brl":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v >= 100 ? 0 : 2, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v);
    case "compact":
      return compact(v);
  }
}

export function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n / 1000)} mil`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
}
