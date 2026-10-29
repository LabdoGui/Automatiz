"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { ACTIVITY_FACTORS, estimateEnergy, type ActivityLevel, type BiologicalSex } from "@/domain/nutrition/estimate";
import { formatInt } from "@/domain/format";

/**
 * Calculadora EDUCATIVA. Roda só no navegador: o sexo informado para a
 * fórmula não é enviado nem salvo. O resultado não vira meta automaticamente.
 */
export function EstimateCalculator({ age, heightCm, weightKg }: { age: number | null; heightCm: number | null; weightKg: number | null }) {
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>("LIGHT");
  const [a, setA] = useState(age ? String(age) : "");
  const [h, setH] = useState(heightCm ? String(heightCm) : "");
  const [w, setW] = useState(weightKg ? String(weightKg).replace(".", ",") : "");
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const result = estimateEnergy({ age: num(a), heightCm: num(h), weightKg: num(w), sex, activity });

  const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 tabular";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm font-semibold">
          Idade
          <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-semibold">
          Altura (cm)
          <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-semibold">
          Peso (kg)
          <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Sexo para a fórmula</legend>
        <div className="flex gap-2">
          {(
            [
              ["FEMALE", "Feminino"],
              ["MALE", "Masculino"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-line text-sm font-semibold has-[:checked]:border-lime has-[:checked]:bg-lime-soft">
              <input type="radio" name="sex-calc" className="sr-only" checked={sex === v} onChange={() => setSex(v)} />
              {l}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">A equação usa sexo biológico. Esse dado fica só no seu aparelho e não é salvo.</p>
      </fieldset>
      <label className="text-sm font-semibold">
        Nível de atividade
        <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className={`${input} mt-1`}>
          {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_FACTORS[k].label}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-2xl bg-surface-2 p-4" aria-live="polite">
        {result.available ? (
          <>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
              <Calculator className="h-4 w-4" aria-hidden /> Estimativa educativa de gasto diário
            </p>
            <p className="mt-2 font-display text-3xl font-extrabold tabular">
              {formatInt(result.low)}–{formatInt(result.high)} <span className="text-base text-ink-3">kcal/dia</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Faixa aproximada para <strong>manter</strong> o peso atual (Mifflin-St Jeor × atividade). Não é uma meta e não
              considera composição corporal, condições de saúde ou medicamentos.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2">{result.reason}</p>
        )}
      </div>
      <p className="text-xs text-ink-3">
        O VIVA não cria metas de déficit ou superávit. Para definir uma meta, converse com um(a) nutricionista e registre os
        valores na seção de meta.
      </p>
    </div>
  );
}
