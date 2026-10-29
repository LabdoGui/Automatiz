import { Info } from "lucide-react";
import { macroEnergySplit, type NutrientKey, type NutrientTotals } from "@/domain/nutrition/calc";
import { formatDec, formatInt } from "@/domain/format";
import { cn } from "../ui/cn";

const MACROS: { key: Exclude<NutrientKey, "kcal">; label: string; short: string; color: string }[] = [
  { key: "proteinG", label: "Proteínas", short: "P", color: "var(--lime)" },
  { key: "carbsG", label: "Carboidratos", short: "C", color: "var(--sky)" },
  { key: "fatG", label: "Gorduras", short: "G", color: "var(--coral)" },
  { key: "fiberG", label: "Fibras", short: "F", color: "var(--amber)" },
];

/** Barra empilhada da distribuição de energia entre macronutrientes. */
export function MacroBar({ totals, className }: { totals: NutrientTotals; className?: string }) {
  const split = macroEnergySplit(totals);
  if (!split) return <div className={cn("h-2 rounded-full bg-surface-3", className)} aria-hidden />;
  const parts = [
    { v: split.protein, c: "var(--lime)", l: "proteínas" },
    { v: split.carbs, c: "var(--sky)", l: "carboidratos" },
    { v: split.fat, c: "var(--coral)", l: "gorduras" },
  ];
  return (
    <div
      className={cn("flex h-2 gap-0.5 overflow-hidden rounded-full", className)}
      role="img"
      aria-label={`Energia: ${parts.map((p) => `${Math.round(p.v * 100)}% de ${p.l}`).join(", ")}`}
    >
      {parts.map((p) => (
        <span key={p.l} style={{ width: `${p.v * 100}%`, background: p.c }} className="h-full first:rounded-l-full last:rounded-r-full" />
      ))}
    </div>
  );
}

export function IncompleteNote({ totals, className }: { totals: NutrientTotals; className?: string }) {
  if (totals.incomplete.length === 0) return null;
  const names = totals.incomplete.map((k) => ({ kcal: "energia", proteinG: "proteínas", carbsG: "carboidratos", fatG: "gorduras", fiberG: "fibras" })[k]);
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-amber-text", className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      Dados incompletos para {names.join(", ")}: algum alimento não tem esse valor na fonte. O total mostrado é parcial.
    </p>
  );
}

/** Linha compacta: 512 kcal · P 32 g · C 60 g · G 12 g */
export function MacroLine({ totals, className }: { totals: NutrientTotals; className?: string }) {
  const v = totals.values;
  const partial = (k: NutrientKey) => (totals.incomplete.includes(k) ? "*" : "");
  return (
    <p className={cn("text-sm text-ink-2 tabular", className)}>
      <span className="font-semibold text-ink">
        ≈ {formatInt(v.kcal)}
        {partial("kcal")} kcal
      </span>
      <span aria-hidden> · </span>P {formatDec(v.proteinG)}
      {partial("proteinG")} g<span aria-hidden> · </span>C {formatDec(v.carbsG)}
      {partial("carbsG")} g<span aria-hidden> · </span>G {formatDec(v.fatG)}
      {partial("fatG")} g
    </p>
  );
}

export function MacroGrid({
  totals,
  goal,
}: {
  totals: NutrientTotals;
  goal?: { proteinG: number | null; carbsG: number | null; fatG: number | null } | null;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {MACROS.map((m) => {
        const target = m.key === "fiberG" ? null : (goal?.[m.key] ?? null);
        const value = totals.values[m.key];
        return (
          <div key={m.key}>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
              {m.label}
            </dt>
            <dd className="mt-0.5 font-display text-xl font-bold tabular">
              {formatDec(value)} g{totals.incomplete.includes(m.key) && <span className="text-amber-text">*</span>}
              {target !== null && <span className="ml-1 text-sm font-medium text-ink-3">/ {formatInt(target)} g</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SourceNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      Valores estimados a partir da Tabela Brasileira de Composição de Alimentos (TACO, 4ª ed., NEPA/UNICAMP, 2011). Variações de
      marca, preparo e porção alteram os números reais.
    </p>
  );
}
