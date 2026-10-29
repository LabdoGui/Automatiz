"use client";

import { useState } from "react";
import { HeartPulse, Leaf, Scale, ShieldAlert, Sparkles, Dumbbell } from "lucide-react";
import type { ProfileFormData } from "@/server/profile/form-data";
import { MEAL_TYPES, MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "@/domain/dates";
import {
  ALLERGENS,
  DIET_RESTRICTIONS,
  FOOD_FAMILIES,
  INTOLERANCES,
  KITCHEN_EQUIPMENT,
  TRAINING_EQUIPMENT,
} from "@/domain/restrictions/vocabulary";
import { GOAL_DESCRIPTION, GOAL_LABEL, LEVEL_LABEL, LOCATION_LABEL } from "@/lib/labels";
import { ChipCheckbox, ChipGroup, OptionCard, Segmented } from "../forms/choices";
import { GroupError, NumberField, SelectField, TextAreaField, TextField } from "../forms/fields";
import { FormMessage } from "../forms/action-form";

const centsToInput = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function PerfilFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-5">
      <TextField name="displayName" label="Como prefere ser chamado(a)?" defaultValue={d.displayName} maxLength={40} required autoComplete="nickname" />
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="age" label="Idade" defaultValue={num(d.age)} suffix="anos" />
        <NumberField name="heightCm" label="Altura" defaultValue={num(d.heightCm)} suffix="cm" />
        <NumberField name="weightKg" label="Peso" decimal defaultValue={num(d.weightKg)} suffix="kg" />
      </div>
      <FormMessage>
        Idade, altura e peso são opcionais. Servem para acompanhar sua evolução e, se você quiser, para estimativas
        educativas. O peso é só um dos indicadores — nunca o único.
      </FormMessage>
    </div>
  );
}

const GOAL_ICON = {
  LOSE_FAT: <Scale className="h-5 w-5" aria-hidden />,
  GAIN_MUSCLE: <Dumbbell className="h-5 w-5" aria-hidden />,
  RECOMPOSITION: <Sparkles className="h-5 w-5" aria-hidden />,
  HABITS: <Leaf className="h-5 w-5" aria-hidden />,
};

export function ObjetivoFields({ d }: { d: ProfileFormData }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Objetivo principal</legend>
      {(Object.keys(GOAL_LABEL) as (keyof typeof GOAL_LABEL)[]).map((g) => (
        <OptionCard key={g} name="goal" value={g} title={GOAL_LABEL[g]} description={GOAL_DESCRIPTION[g]} icon={GOAL_ICON[g]} defaultChecked={d.goal === g} />
      ))}
      <GroupError name="goal" />
    </fieldset>
  );
}

export function RotinaFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-6">
      <Segmented
        name="experienceLevel"
        legend="Experiência com exercícios"
        defaultValue={d.experienceLevel ?? ""}
        options={(Object.keys(LEVEL_LABEL) as (keyof typeof LEVEL_LABEL)[]).map((k) => ({ value: k, label: LEVEL_LABEL[k] }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField name="wakeTime" label="Costuma acordar" type="time" defaultValue={d.wakeTime} />
        <TextField name="sleepTime" label="Costuma dormir" type="time" defaultValue={d.sleepTime} />
      </div>
      <ChipGroup legend="Dias de treino" hint="Descanso faz parte do plano. Escolha o que cabe na sua semana.">
        {WEEKDAY_SHORT.map((label, i) => (
          <ChipCheckbox key={i} name="trainingWeekdays" value={String(i)} label={<span aria-label={WEEKDAY_LONG[i]}>{label}</span>} defaultChecked={d.trainingWeekdays.includes(i)} />
        ))}
      </ChipGroup>
      <div className="grid grid-cols-2 gap-3">
        <TextField name="trainingTime" label="Horário do treino" type="time" defaultValue={d.trainingTime} />
        <NumberField name="trainingMinutes" label="Duração" defaultValue={num(d.trainingMinutes)} suffix="min" />
      </div>
      <Segmented
        name="trainingLocation"
        legend="Onde você treina"
        defaultValue={d.trainingLocation ?? ""}
        options={(Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]).map((k) => ({ value: k, label: LOCATION_LABEL[k] }))}
      />
      <ChipGroup legend="Equipamentos disponíveis" hint="Principalmente para treinos em casa ou ao ar livre.">
        {TRAINING_EQUIPMENT.map((e) => (
          <ChipCheckbox key={e.tag} name="trainingEquipment" value={e.tag} label={e.label} defaultChecked={d.trainingEquipment.includes(e.tag)} />
        ))}
      </ChipGroup>
      <TextAreaField name="routineNotes" label="Algo sobre sua rotina? (opcional)" placeholder="Ex.: trabalho em turnos, almoço fora de casa às terças…" defaultValue={d.routineNotes} maxLength={300} />
    </div>
  );
}

export function RefeicoesFields({ d }: { d: ProfileFormData }) {
  const [flex, setFlex] = useState(d.flexibleMealEnabled);
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Quais refeições você faz?</legend>
        <p className="mb-3 text-xs text-ink-3">Marque as refeições e ajuste os horários aproximados.</p>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {MEAL_TYPES.map((m) => (
            <li key={m} className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 font-medium">
                <input type="checkbox" name="mealSlots" value={m} defaultChecked={d.mealSlots.includes(m)} className="h-5 w-5 accent-[var(--lime)]" />
                {MEAL_TYPE_LABEL[m]}
              </label>
              <label className="sr-only" htmlFor={`time_${m}`}>
                Horário — {MEAL_TYPE_LABEL[m]}
              </label>
              <input
                id={`time_${m}`}
                type="time"
                name={`time_${m}`}
                defaultValue={d.mealTimes[m]}
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm tabular"
              />
            </li>
          ))}
        </ul>
        <GroupError name="mealSlots" />
      </fieldset>
      <Segmented
        name="cookingStyle"
        legend="Que tipo de receita você prefere?"
        defaultValue={d.cookingStyle ?? ""}
        options={[
          { value: "QUICK", label: "Rápidas" },
          { value: "BALANCED", label: "Tanto faz" },
          { value: "ELABORATE", label: "Elaboradas" },
        ]}
      />
      <NumberField name="cookingMinutes" label="Tempo máximo para preparar uma refeição" defaultValue={num(d.cookingMinutes)} suffix="min" hint="Deixe em branco se não tiver limite." />
      <ChipGroup legend="Utensílios disponíveis" hint="Receitas que exigem outros utensílios não serão sugeridas.">
        {KITCHEN_EQUIPMENT.map((e) => (
          <ChipCheckbox key={e.tag} name="kitchenEquipment" value={e.tag} label={e.label} defaultChecked={d.kitchenEquipment.includes(e.tag)} />
        ))}
      </ChipGroup>
      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-2">
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Refeição flexível</span>
            <span className="block text-sm text-ink-2">Um momento livre na semana, sem planejamento — com tranquilidade, sem culpa.</span>
          </span>
          <input type="checkbox" name="flexibleMealEnabled" checked={flex} onChange={(e) => setFlex(e.target.checked)} className="h-6 w-6 accent-[var(--lime)]" />
        </label>
        {flex && (
          <div className="grid grid-cols-2 gap-3 pb-3">
            <SelectField name="flexibleMealWeekday" label="Dia" defaultValue={d.flexibleMealWeekday ?? 5}>
              {WEEKDAY_LONG.map((w, i) => (
                <option key={i} value={i}>
                  {w}
                </option>
              ))}
            </SelectField>
            <SelectField name="flexibleMealType" label="Refeição" defaultValue={d.flexibleMealType ?? "DINNER"}>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {MEAL_TYPE_LABEL[m]}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </div>
    </div>
  );
}

export function GostosFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4">
        <h3 className="text-base font-bold">Do que você gosta</h3>
        {(
          [
            ["proteinas", "Proteínas"],
            ["basicos", "Básicos"],
            ["frutas", "Frutas"],
            ["vegetais", "Verduras e legumes"],
          ] as const
        ).map(([group, label]) => (
          <ChipGroup key={group} legend={label}>
            {FOOD_FAMILIES[group].map(([tag, name]) => (
              <ChipCheckbox key={tag} name="favorites" value={tag} label={name} defaultChecked={d.favorites.includes(tag)} />
            ))}
          </ChipGroup>
        ))}
        <TextField name="favoritesText" label="Outros favoritos" placeholder="Separe por vírgulas" defaultValue={d.favoritesText} />
      </section>
      <section className="flex flex-col gap-4">
        <h3 className="text-base font-bold">O que você não come por gosto</h3>
        <ChipGroup legend="Frutas que não gosta">
          {FOOD_FAMILIES.frutas.map(([tag, name]) => (
            <ChipCheckbox key={tag} name="dislikes" value={tag} label={name} tone="coral" defaultChecked={d.dislikes.includes(tag)} />
          ))}
        </ChipGroup>
        <ChipGroup legend="Verduras e legumes que não consome">
          {FOOD_FAMILIES.vegetais.map(([tag, name]) => (
            <ChipCheckbox key={tag} name="dislikes" value={tag} label={name} tone="coral" defaultChecked={d.dislikes.includes(tag)} />
          ))}
        </ChipGroup>
        <ChipGroup legend="Outros alimentos">
          {[...FOOD_FAMILIES.proteinas, ...FOOD_FAMILIES.basicos].map(([tag, name]) => (
            <ChipCheckbox key={tag} name="dislikes" value={tag} label={name} tone="coral" defaultChecked={d.dislikes.includes(tag)} />
          ))}
        </ChipGroup>
        <TextField name="dislikesText" label="Mais alimentos que não come por preferência" placeholder="Ex.: jiló, fígado" defaultValue={d.dislikesText} />
        <TextField name="avoidText" label="Ingredientes que deseja evitar" placeholder="Ex.: açúcar, frituras" defaultValue={d.avoidText} />
      </section>
    </div>
  );
}

export function RestricoesFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-ink">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-text" aria-hidden />
        <p>
          Alergias, intolerâncias e restrições são tratadas como <strong>críticas</strong>: alimentos incompatíveis nunca
          aparecem em sugestões. Isso é diferente de gosto pessoal. Em caso de alergia grave, confira sempre o rótulo.
        </p>
      </div>
      <ChipGroup legend="Alergias" hint="Grupos de alergênicos da rotulagem brasileira (ANVISA).">
        {ALLERGENS.map((a) => (
          <ChipCheckbox key={a.tag} name="allergies" value={a.tag} label={a.label} tone="danger" defaultChecked={d.allergies.includes(a.tag)} />
        ))}
      </ChipGroup>
      <TextField name="allergiesText" label="Outras alergias" placeholder="Ex.: kiwi, morango" defaultValue={d.allergiesText} hint="Comparamos pelo nome dos alimentos. Prefira as opções acima quando existirem." />
      <ChipGroup legend="Intolerâncias">
        {INTOLERANCES.map((a) => (
          <ChipCheckbox key={a.tag} name="intolerances" value={a.tag} label={a.label} tone="danger" defaultChecked={d.intolerances.includes(a.tag)} />
        ))}
      </ChipGroup>
      <ChipGroup legend="Restrições alimentares">
        {DIET_RESTRICTIONS.map((a) => (
          <ChipCheckbox key={a.tag} name="restrictions" value={a.tag} label={a.label} defaultChecked={d.restrictions.includes(a.tag)} />
        ))}
      </ChipGroup>
      <FormMessage>
        Condições clínicas (como diabetes, doença renal ou gestação) exigem orientação profissional. O VIVA não gera planos
        clínicos.
      </FormMessage>
    </div>
  );
}

export function OrcamentoFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-5">
      <TextField name="budget" label="Quanto pretende gastar com alimentação?" inputMode="decimal" placeholder="0,00" defaultValue={centsToInput(d.budgetCents)} suffix="R$" hint="Use o formato 250,00. Você pode mudar quando quiser." />
      <Segmented
        name="budgetPeriod"
        legend="Periodicidade"
        defaultValue={d.budgetPeriod ?? "WEEK"}
        options={[
          { value: "DAY", label: "Por dia" },
          { value: "WEEK", label: "Por semana" },
          { value: "MONTH", label: "Por mês" },
        ]}
      />
      <GroupError name="budgetPeriod" />
      <FormMessage>
        A lista de compras compara o total estimado com o equivalente semanal do seu orçamento. Valores mensais são convertidos
        pela média de dias do mês.
      </FormMessage>
    </div>
  );
}

export function MetaFields({ d }: { d: ProfileFormData }) {
  const [has, setHas] = useState<"yes" | "no" | "">(d.hasNutritionist);
  const [water, setWater] = useState(d.trackWater);
  const isProfessional = d.goalSource === "PROFESSIONAL";
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">Você tem orientação de nutricionista?</legend>
        {(
          [
            ["yes", "Sim", "Vou registrar os valores que o profissional passou."],
            ["no", "Não", "Tudo bem — o VIVA não inventa uma meta para você."],
          ] as const
        ).map(([value, title, description]) => (
          <label
            key={value}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 has-[:checked]:border-lime has-[:checked]:bg-lime-soft"
          >
            <input type="radio" name="hasNutritionist" value={value} checked={has === value} onChange={() => setHas(value)} className="h-5 w-5 accent-[var(--lime)]" />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-ink-2">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {has === "yes" && (
        <div className="flex flex-col gap-4 rounded-3xl border border-line p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-lime-text">
            <HeartPulse className="h-4 w-4" aria-hidden /> Meta informada pelo profissional
          </div>
          <Segmented
            name="period"
            legend="A meta de energia é"
            defaultValue={isProfessional ? d.goalPeriod : "DAY"}
            options={[
              { value: "DAY", label: "Diária" },
              { value: "WEEK", label: "Semanal" },
            ]}
          />
          <NumberField name="kcal" label="Energia" defaultValue={isProfessional ? num(d.goalKcal) : ""} suffix="kcal" hint="Confira se o valor é por dia ou por semana — não convertemos sem você escolher." />
          <div className="grid grid-cols-3 gap-3">
            <NumberField name="proteinG" label="Proteínas" defaultValue={isProfessional ? num(d.goalProteinG) : ""} suffix="g" />
            <NumberField name="carbsG" label="Carboidr." defaultValue={isProfessional ? num(d.goalCarbsG) : ""} suffix="g" />
            <NumberField name="fatG" label="Gorduras" defaultValue={isProfessional ? num(d.goalFatG) : ""} suffix="g" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField name="mealsPerDay" label="Refeições por dia" defaultValue={isProfessional ? num(d.goalMeals) : ""} />
            <TextField name="professionalName" label="Profissional (opcional)" defaultValue={isProfessional ? d.goalProfessional : ""} maxLength={80} />
          </div>
          <TextAreaField name="notes" label="Observações do plano" defaultValue={isProfessional ? d.goalNotes : ""} maxLength={600} />
        </div>
      )}
      {has === "no" && (
        <FormMessage>
          Sem meta definida, mostramos porções de referência e os valores estimados de cada refeição. No perfil há uma
          calculadora educativa — ela não substitui avaliação profissional.
        </FormMessage>
      )}

      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-2">
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Acompanhar água</span>
            <span className="block text-sm text-ink-2">Registros rápidos no início, sem notificações insistentes.</span>
          </span>
          <input type="checkbox" name="trackWater" checked={water} onChange={(e) => setWater(e.target.checked)} className="h-6 w-6 accent-[var(--lime)]" />
        </label>
        {water && (
          <div className="pb-3">
            <NumberField name="waterGoalMl" label="Meta diária de água" defaultValue={num(d.waterGoalMl ?? 2000)} suffix="ml" />
          </div>
        )}
      </div>
    </div>
  );
}

export function DespensaFields({ d }: { d: ProfileFormData }) {
  return (
    <div className="flex flex-col gap-4">
      <FormMessage>
        Informe só o que já tem em casa, em gramas aproximadas (para ovos, 1 unidade ≈ 50 g). Esses itens são descontados da
        lista de compras. Deixe em branco o que não tiver.
      </FormMessage>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {Object.entries(d.pantryLabels).map(([key, label]) => (
          <li key={key} className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2">
            <label htmlFor={`pantry_${key}`} className="text-sm font-medium">
              {label}
            </label>
            <div className="relative w-32 shrink-0">
              <input
                id={`pantry_${key}`}
                name={`pantry_${key}`}
                inputMode="numeric"
                defaultValue={d.pantry[key] ? String(Math.round(d.pantry[key])) : ""}
                placeholder="0"
                className="h-10 w-full rounded-xl border border-line bg-surface pr-8 pl-3 text-right tabular"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">g</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const STEP_COMPONENTS = {
  perfil: PerfilFields,
  objetivo: ObjetivoFields,
  rotina: RotinaFields,
  refeicoes: RefeicoesFields,
  gostos: GostosFields,
  restricoes: RestricoesFields,
  orcamento: OrcamentoFields,
  meta: MetaFields,
  despensa: DespensaFields,
} as const;

export const STEP_META: Record<keyof typeof STEP_COMPONENTS, { title: string; intro: string; skippable: boolean }> = {
  perfil: { title: "Vamos nos conhecer", intro: "Comece pelo básico. O resto pode ficar para depois.", skippable: false },
  objetivo: { title: "Qual é o seu objetivo?", intro: "Ele orienta sugestões de treino e de rotina — não define seu valor.", skippable: false },
  rotina: { title: "Sua rotina", intro: "Horários e dias de treino nos ajudam a montar uma semana realista.", skippable: true },
  refeicoes: { title: "Suas refeições", intro: "Quantas refeições, em que horários e quanto tempo você tem para cozinhar.", skippable: false },
  gostos: { title: "Gostos e preferências", intro: "O que você ama e o que prefere evitar. Gosto não precisa de justificativa.", skippable: true },
  restricoes: { title: "Alergias e restrições", intro: "Informações críticas para a sua segurança.", skippable: true },
  orcamento: { title: "Orçamento", intro: "Quanto você quer gastar com comida. Usamos para a lista de compras.", skippable: true },
  meta: { title: "Meta nutricional", intro: "Registramos metas de profissionais. Não criamos prescrições.", skippable: true },
  despensa: { title: "O que já tem em casa", intro: "Para não comprar o que já está no armário.", skippable: true },
};
