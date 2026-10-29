"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil, ShieldAlert } from "lucide-react";
import type { ProfileFormData } from "@/server/profile/form-data";
import { STEP_KEYS } from "@/server/profile/step-keys";
import {
  saveOnboardingStepAction,
  skipOnboardingStepAction,
  finishOnboardingAction,
} from "@/server/actions/profile";
import { MEAL_TYPE_LABEL, type MealType } from "@/domain/planner/meal-types";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { formatBRL, formatInt } from "@/domain/format";
import { labelForTag } from "@/domain/restrictions/vocabulary";
import { BUDGET_PERIOD_LABEL, GOAL_LABEL, GOAL_PERIOD_LABEL, LEVEL_LABEL, LOCATION_LABEL } from "@/lib/labels";
import { ActionForm } from "../forms/action-form";
import { SubmitButton } from "../forms/fields";
import { buttonClasses } from "../ui/button";
import { Logo } from "../brand/logo";
import { cn } from "../ui/cn";
import { STEP_COMPONENTS, STEP_META } from "./step-forms";

export function OnboardingFlow({ data, initialStep }: { data: ProfileFormData; initialStep: number }) {
  const [step, setStep] = useState(Math.min(Math.max(0, initialStep), STEP_KEYS.length));
  const [skipping, startSkip] = useTransition();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = STEP_KEYS.length;
  const isSummary = step >= total;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  const go = (next: number) => setStep(Math.min(Math.max(0, next), total));

  const key = STEP_KEYS[Math.min(step, total - 1)];
  const meta = STEP_META[key];
  const Fields = STEP_COMPONENTS[key];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-5 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo size="sm" />
        <p className="text-sm font-semibold text-ink-2 tabular" aria-live="polite">
          {isSummary ? "Resumo" : `Etapa ${step + 1} de ${total}`}
        </p>
      </header>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {STEP_KEYS.map((k, i) => (
          <span key={k} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < step || isSummary ? "bg-lime" : i === step ? "bg-ink-2" : "bg-surface-3")} />
        ))}
      </div>

      {!isSummary ? (
        <ActionForm
          key={key}
          action={saveOnboardingStepAction}
          showSuccessToast={false}
          onSuccess={() => {
            router.refresh();
            go(step + 1);
          }}
          className="flex flex-1 flex-col"
          aria-label={meta.title}
        >
          <input type="hidden" name="step" value={key} />
          <div className="flex-1 animate-rise pt-8 pb-6">
            <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight font-extrabold outline-none sm:text-4xl">
              {meta.title}
            </h1>
            <p className="mt-2 mb-7 text-ink-2">{meta.intro}</p>
            <Fields d={data} />
          </div>
          <div className="sticky bottom-0 -mx-5 mt-auto flex items-center gap-2 border-t border-line bg-bg/95 px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-8 sm:px-8">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className={buttonClasses({ variant: "ghost" })}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {meta.skippable && (
                <button
                  type="button"
                  disabled={skipping}
                  onClick={() =>
                    startSkip(async () => {
                      await skipOnboardingStepAction(key);
                      go(step + 1);
                    })
                  }
                  className={buttonClasses({ variant: "ghost" })}
                >
                  Pular
                </button>
              )}
              <SubmitButton pendingLabel="Salvando…">
                Continuar <ArrowRight className="h-4 w-4" aria-hidden />
              </SubmitButton>
            </div>
          </div>
        </ActionForm>
      ) : (
        <Summary data={data} headingRef={headingRef} onEdit={go} />
      )}
    </div>
  );
}

function Row({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{label}</dt>
        <dd className="mt-1 text-[0.95rem]">{children}</dd>
      </div>
      <button type="button" onClick={onEdit} className={buttonClasses({ variant: "ghost", size: "icon-sm" })} aria-label={`Editar ${label.toLowerCase()}`}>
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function Summary({
  data: d,
  headingRef,
  onEdit,
}: {
  data: ProfileFormData;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onEdit: (step: number) => void;
}) {
  const router = useRouter();
  const at = (k: (typeof STEP_KEYS)[number]) => () => onEdit(STEP_KEYS.indexOf(k));
  const critical = [...d.allergies, ...d.intolerances].map(labelForTag).concat(d.allergiesText ? d.allergiesText.split(", ") : []);
  const diets = d.restrictions.map(labelForTag);
  const hasProfessionalGoal = d.goalSource === "PROFESSIONAL" && (d.goalKcal || d.goalProteinG || d.goalCarbsG || d.goalFatG);
  return (
    <ActionForm
      action={finishOnboardingAction}
      showSuccessToast={false}
      onSuccess={() => router.push("/inicio?bemvindo=1")}
      className="flex flex-1 flex-col"
      aria-label="Confirmar perfil"
    >
      <div className="flex-1 animate-rise pt-8 pb-6">
        <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight font-extrabold outline-none sm:text-4xl">
          Tudo certo, {d.displayName}?
        </h1>
        <p className="mt-2 mb-6 text-ink-2">Confira o resumo. Você pode editar qualquer item agora ou depois, no perfil.</p>
        <dl className="divide-y divide-line border-y border-line">
          <Row label="Objetivo" onEdit={at("objetivo")}>
            {d.goal ? GOAL_LABEL[d.goal as keyof typeof GOAL_LABEL] : <span className="text-danger-text">Ainda não escolhido</span>}
          </Row>
          <Row label="Refeições" onEdit={at("refeicoes")}>
            {d.mealSlots.map((m) => `${MEAL_TYPE_LABEL[m as MealType]} (${d.mealTimes[m]})`).join(" · ")}
            {d.flexibleMealEnabled && <span className="block text-sm text-ink-2">Com uma refeição flexível na semana</span>}
          </Row>
          <Row label="Preferências" onEdit={at("gostos")}>
            {d.favorites.length + (d.favoritesText ? 1 : 0) > 0 ? (
              <span>Gosta de {[...d.favorites.map(labelForTag), d.favoritesText].filter(Boolean).join(", ")}</span>
            ) : (
              <span className="text-ink-2">Sem favoritos informados</span>
            )}
            {(d.dislikes.length > 0 || d.dislikesText || d.avoidText) && (
              <span className="block text-sm text-ink-2">
                Evita: {[...d.dislikes.map(labelForTag), d.dislikesText, d.avoidText].filter(Boolean).join(", ")}
              </span>
            )}
          </Row>
          <Row label="Alergias e restrições" onEdit={at("restricoes")}>
            {critical.length + diets.length === 0 ? (
              <span className="text-ink-2">Nenhuma informada</span>
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {critical.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-sm font-semibold text-danger-text">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> {c}
                  </span>
                ))}
                {diets.map((c) => (
                  <span key={c} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold">
                    {c}
                  </span>
                ))}
              </span>
            )}
          </Row>
          <Row label="Orçamento" onEdit={at("orcamento")}>
            {d.budgetCents && d.budgetPeriod ? (
              `${formatBRL(d.budgetCents)} ${BUDGET_PERIOD_LABEL[d.budgetPeriod as keyof typeof BUDGET_PERIOD_LABEL]}`
            ) : (
              <span className="text-ink-2">Sem orçamento definido</span>
            )}
          </Row>
          <Row label="Treinos" onEdit={at("rotina")}>
            {d.trainingWeekdays.length > 0 ? (
              <>
                {d.trainingWeekdays.length}× por semana ({d.trainingWeekdays.map((i) => WEEKDAY_SHORT[i]).join(", ")})
                <span className="block text-sm text-ink-2">
                  {[d.experienceLevel && LEVEL_LABEL[d.experienceLevel as keyof typeof LEVEL_LABEL], d.trainingLocation && LOCATION_LABEL[d.trainingLocation as keyof typeof LOCATION_LABEL]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : (
              <span className="text-ink-2">Dias de treino não definidos</span>
            )}
          </Row>
          <Row label="Meta nutricional" onEdit={at("meta")}>
            {hasProfessionalGoal ? (
              <>
                Meta do(a) nutricionista: {d.goalKcal ? `${formatInt(d.goalKcal)} kcal ${GOAL_PERIOD_LABEL[d.goalPeriod]}` : "energia não informada"}
                {(d.goalProteinG || d.goalCarbsG || d.goalFatG) && (
                  <span className="block text-sm text-ink-2">
                    P {d.goalProteinG ?? "—"} g · C {d.goalCarbsG ?? "—"} g · G {d.goalFatG ?? "—"} g
                  </span>
                )}
              </>
            ) : (
              <span className="text-ink-2">Meta ainda não definida — usaremos porções de referência.</span>
            )}
          </Row>
        </dl>
      </div>
      <div className="sticky bottom-0 -mx-5 mt-auto flex items-center gap-2 border-t border-line bg-bg/95 px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-8 sm:px-8">
        <button type="button" onClick={() => onEdit(STEP_KEYS.length - 1)} className={buttonClasses({ variant: "ghost" })}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
        </button>
        <SubmitButton className="ml-auto" size="lg" pendingLabel="Montando sua semana…">
          Confirmar e gerar planejamento
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
