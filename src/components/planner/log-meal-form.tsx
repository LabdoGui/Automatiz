"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { MEAL_TYPES, MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { logMealAction } from "@/server/actions/planner";
import { ActionForm } from "../forms/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "../forms/fields";
import { FoodPicker } from "../food/food-picker";
import { buttonClasses } from "../ui/button";

/** Registro de refeição fora do planejamento, com itens opcionais. */
export function LogMealForm({ date, maxDate, minDate }: { date: string; maxDate: string; minDate: string }) {
  const [rows, setRows] = useState<number[]>([1]);
  const [next, setNext] = useState(2);
  return (
    <ActionForm action={logMealAction} redirectTo={`/alimentacao?dia=${date}`} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <TextField name="date" label="Dia" type="date" defaultValue={date} min={minDate} max={maxDate} />
        <SelectField name="mealType" label="Refeição" defaultValue="">
          <option value="">Não especificar</option>
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {MEAL_TYPE_LABEL[m]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField name="title" label="O que você comeu?" placeholder="Ex.: Almoço no restaurante" maxLength={80} />
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold">Itens (opcional)</legend>
        <p className="-mt-2 text-xs text-ink-3">Adicione os alimentos se quiser estimar os nutrientes. Sem itens, registramos só a refeição.</p>
        {rows.map((key, index) => (
          <div key={key} className="flex flex-col gap-3 rounded-2xl border border-line p-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FoodPicker label={`Alimento ${index + 1}`} />
            </div>
            <div className="flex items-end gap-2">
              <div className="w-32">
                <label className="text-sm font-semibold" htmlFor={`grams-${key}`}>
                  Quantidade (g)
                </label>
                <input
                  id={`grams-${key}`}
                  name="grams"
                  inputMode="decimal"
                  placeholder="100"
                  className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 tabular"
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((x) => x !== key))}
                  className={buttonClasses({ variant: "ghost", size: "icon" })}
                  aria-label={`Remover alimento ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length < 20 && (
          <button
            type="button"
            onClick={() => {
              setRows((r) => [...r, next]);
              setNext((n) => n + 1);
            }}
            className={buttonClasses({ variant: "outline", size: "sm", className: "self-start" })}
          >
            <Plus className="h-4 w-4" aria-hidden /> Mais um alimento
          </button>
        )}
      </fieldset>
      <TextAreaField name="notes" label="Observações (opcional)" maxLength={400} />
      <SubmitButton size="lg" block>
        Registrar refeição
      </SubmitButton>
    </ActionForm>
  );
}
