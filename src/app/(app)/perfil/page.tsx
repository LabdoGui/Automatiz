import type { Metadata } from "next";
import Link from "next/link";
import { Download, HeartPulse, LogOut, Palette, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { formatBRL, formatDateBR, formatGrams, formatInt } from "@/domain/format";
import { levelFromXp, mascotForLevel } from "@/domain/gamification/rules";
import { MEAL_TYPE_LABEL, type MealType } from "@/domain/planner/meal-types";
import { labelForTag } from "@/domain/restrictions/vocabulary";
import { BUDGET_PERIOD_LABEL, GOAL_LABEL, GOAL_PERIOD_LABEL, LEVEL_LABEL, LOCATION_LABEL } from "@/lib/labels";
import { Mascot } from "@/components/brand/mascot";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Meter } from "@/components/ui/meter";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { Segmented, Toggle } from "@/components/forms/choices";
import { SectionEditor } from "@/components/profile/section-editor";
import { EstimateCalculator } from "@/components/profile/estimate-calculator";
import { requireOnboardedUser } from "@/server/session";
import { aiSettings } from "@/server/ai/claude";
import { db } from "@/server/db";
import { buildProfileFormData } from "@/server/profile/form-data";
import { getActiveGoal } from "@/server/services/profile";
import { clearGoalAction, saveGoalAction, saveSettingsAction, setAiOptInAction } from "@/server/actions/profile";
import { deleteAccountAction, signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Perfil" };

const TIMEZONES = [
  ["America/Sao_Paulo", "Brasília (BRT)"],
  ["America/Manaus", "Manaus (AMT)"],
  ["America/Cuiaba", "Cuiabá"],
  ["America/Belem", "Belém"],
  ["America/Fortaleza", "Fortaleza"],
  ["America/Recife", "Recife"],
  ["America/Bahia", "Salvador"],
  ["America/Porto_Velho", "Porto Velho"],
  ["America/Boa_Vista", "Boa Vista"],
  ["America/Rio_Branco", "Rio Branco (ACT)"],
  ["America/Noronha", "Fernando de Noronha"],
] as const;

function Row({ label, children, action, id }: { label: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-24 items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{label}</dt>
        <dd className="mt-1">{children}</dd>
      </div>
      {action}
    </div>
  );
}

export default async function ProfilePage() {
  const { user, profile, settings } = await requireOnboardedUser();
  const [d, goal, consents] = await Promise.all([
    buildProfileFormData(user.id, user.name),
    getActiveGoal(user.id),
    db.consentRecord.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" } }),
  ]);
  const level = levelFromXp(profile.xpTotal);
  const mascot = mascotForLevel(level.level);
  const muted = (t: string) => <span className="text-ink-2">{t}</span>;
  const critical = [...d.allergies, ...d.intolerances].map(labelForTag).concat(d.allergiesText ? d.allergiesText.split(", ") : []);
  const aiConfigured = aiSettings().configured;

  return (
    <>
      <PageHeader eyebrow="Perfil" title={d.displayName} description={user.email} />

      <Link href="/conquistas" className="mb-8 flex items-center gap-4 rounded-[2rem] border border-line bg-surface p-4 hover:bg-surface-2">
        <Mascot stage={mascot.key} size={72} animated={false} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">
            Nível {level.level} · {mascot.name}
          </p>
          <Meter className="mt-2" value={level.progress} label="Progresso até o próximo nível" />
          <p className="mt-1 text-xs text-ink-2 tabular">
            {formatInt(level.xp - level.levelStartXp)} de {formatInt(level.nextLevelXp - level.levelStartXp)} XP para o nível {level.level + 1}
          </p>
        </div>
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div>
          <SectionTitle>Seu perfil</SectionTitle>
          <dl className="divide-y divide-line border-y border-line">
            <Row label="Dados pessoais" action={<SectionEditor step="perfil" data={d} label="Dados pessoais" />}>
              {d.displayName}
              <span className="block text-sm text-ink-2">
                {[d.age && `${d.age} anos`, d.heightCm && `${d.heightCm} cm`, d.weightKg && `${String(d.weightKg).replace(".", ",")} kg (último registro)`].filter(Boolean).join(" · ") ||
                  "Idade, altura e peso não informados"}
              </span>
            </Row>
            <Row label="Objetivo" action={<SectionEditor step="objetivo" data={d} label="Objetivo" />}>
              {d.goal ? GOAL_LABEL[d.goal as keyof typeof GOAL_LABEL] : muted("Não definido")}
            </Row>
            <Row label="Rotina e treinos" action={<SectionEditor step="rotina" data={d} label="Rotina" />}>
              {d.trainingWeekdays.length ? `${d.trainingWeekdays.length}× por semana · ${d.trainingWeekdays.map((i) => WEEKDAY_SHORT[i]).join(", ")}` : muted("Dias de treino não definidos")}
              <span className="block text-sm text-ink-2">
                {[d.experienceLevel && LEVEL_LABEL[d.experienceLevel as keyof typeof LEVEL_LABEL], d.trainingLocation && LOCATION_LABEL[d.trainingLocation as keyof typeof LOCATION_LABEL], d.wakeTime && `acorda ${d.wakeTime}`, d.sleepTime && `dorme ${d.sleepTime}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Row>
            <Row label="Refeições" action={<SectionEditor step="refeicoes" data={d} label="Refeições" />}>
              {d.mealSlots.map((m) => MEAL_TYPE_LABEL[m as MealType]).join(", ")}
              <span className="block text-sm text-ink-2">
                {d.cookingMinutes ? `até ${d.cookingMinutes} min de preparo` : "sem limite de preparo"}
                {d.flexibleMealEnabled ? " · refeição flexível ativada" : ""}
              </span>
            </Row>
            <Row label="Gostos e preferências" action={<SectionEditor step="gostos" data={d} label="Gostos" />}>
              {d.favorites.length || d.favoritesText ? `Gosta de ${[...d.favorites.map(labelForTag), d.favoritesText].filter(Boolean).join(", ")}` : muted("Sem favoritos")}
              {(d.dislikes.length > 0 || d.dislikesText || d.avoidText) && (
                <span className="block text-sm text-ink-2">Evita: {[...d.dislikes.map(labelForTag), d.dislikesText, d.avoidText].filter(Boolean).join(", ")}</span>
              )}
            </Row>
            <Row label="Alergias e restrições" action={<SectionEditor step="restricoes" data={d} label="Alergias e restrições" />}>
              {critical.length + d.restrictions.length === 0 ? (
                muted("Nenhuma informada")
              ) : (
                <span className="flex flex-wrap gap-1.5">
                  {critical.map((c) => (
                    <Badge key={c} tone="danger">
                      <ShieldAlert className="h-3 w-3" aria-hidden /> {c}
                    </Badge>
                  ))}
                  {d.restrictions.map((r) => (
                    <Badge key={r}>{labelForTag(r)}</Badge>
                  ))}
                </span>
              )}
            </Row>
            <Row id="orcamento" label="Orçamento" action={<SectionEditor step="orcamento" data={d} label="Orçamento" />}>
              {d.budgetCents && d.budgetPeriod ? `${formatBRL(d.budgetCents)} ${BUDGET_PERIOD_LABEL[d.budgetPeriod as keyof typeof BUDGET_PERIOD_LABEL]}` : muted("Sem orçamento")}
            </Row>
            <Row label="Hidratação e orientação" action={<SectionEditor step="meta" data={d} label="Hidratação e orientação" />}>
              {d.trackWater && d.waterGoalMl ? `Meta de água: ${formatInt(d.waterGoalMl)} ml/dia` : muted("Água não acompanhada")}
              <span className="block text-sm text-ink-2">
                {d.hasNutritionist === "yes" ? "Tem orientação de nutricionista" : d.hasNutritionist === "no" ? "Sem nutricionista no momento" : "Orientação profissional não informada"}
              </span>
            </Row>
            <Row label="Despensa" action={<SectionEditor step="despensa" data={d} label="Despensa" />}>
              {Object.keys(d.pantry).length
                ? Object.entries(d.pantry)
                    .map(([k, g]) => `${d.pantryLabels[k]} (${formatGrams(g)})`)
                    .join(", ")
                : muted("Nenhum item básico registrado")}
              <Link href="/alimentacao/despensa" className="block text-sm font-semibold text-lime-text hover:underline">
                Gerenciar despensa completa
              </Link>
            </Row>
          </dl>
        </div>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="meta" id="meta" className="scroll-mt-24">
            <SectionTitle id="meta">Meta nutricional</SectionTitle>
            <div className="rounded-3xl border border-line bg-surface p-5">
              {goal ? (
                <>
                  <Badge tone={goal.source === "PROFESSIONAL" ? "lime" : "sky"}>
                    {goal.source === "PROFESSIONAL" ? "Informada por profissional" : "Registrada por você"}
                  </Badge>
                  <p className="mt-3 font-display text-3xl font-extrabold tabular">
                    {goal.kcal ? `${formatInt(goal.kcal)} kcal` : "Energia não definida"}
                    <span className="ml-1 text-base font-semibold text-ink-3">{GOAL_PERIOD_LABEL[goal.period]}</span>
                  </p>
                  {goal.period === "WEEK" && goal.kcal && <p className="text-sm text-ink-2">Média diária equivalente: {formatInt(Math.round(goal.kcal / 7))} kcal</p>}
                  <p className="mt-2 text-sm text-ink-2 tabular">
                    Proteínas {goal.proteinG ?? "—"} g · Carboidratos {goal.carbsG ?? "—"} g · Gorduras {goal.fatG ?? "—"} g
                    {goal.mealsPerDay ? ` · ${goal.mealsPerDay} refeições/dia` : ""}
                  </p>
                  {goal.professionalName && <p className="mt-1 text-sm text-ink-2">Profissional: {goal.professionalName}</p>}
                  {goal.notes && <p className="mt-2 whitespace-pre-line text-sm">{goal.notes}</p>}
                  <p className="mt-2 text-xs text-ink-3">Registrada em {formatDateBR(goal.createdAt.toISOString().slice(0, 10))}</p>
                </>
              ) : (
                <p className="text-sm text-ink-2">
                  <HeartPulse className="mr-1.5 inline h-4 w-4 text-ink-3" aria-hidden />
                  Meta ainda não definida. O planejamento usa porções de referência.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Dialog title={goal ? "Atualizar meta" : "Registrar meta"} description="A meta anterior fica guardada no histórico." trigger={goal ? "Atualizar" : "Registrar meta"} triggerSize="sm">
                  <ActionForm action={saveGoalAction} closeDialogOnSuccess className="flex flex-col gap-4">
                    <Segmented
                      name="source"
                      legend="Origem da meta"
                      defaultValue={goal?.source ?? (d.hasNutritionist === "yes" ? "PROFESSIONAL" : "SELF")}
                      options={[
                        { value: "PROFESSIONAL", label: "De um profissional" },
                        { value: "SELF", label: "Minha" },
                      ]}
                    />
                    <Segmented
                      name="period"
                      legend="Período"
                      defaultValue={goal?.period ?? "DAY"}
                      options={[
                        { value: "DAY", label: "Por dia" },
                        { value: "WEEK", label: "Por semana" },
                      ]}
                    />
                    <NumberField name="kcal" label="Energia" suffix="kcal" defaultValue={goal?.kcal ? String(goal.kcal) : ""} />
                    <div className="grid grid-cols-3 gap-3">
                      <NumberField name="proteinG" label="Proteínas" suffix="g" defaultValue={goal?.proteinG ? String(goal.proteinG) : ""} />
                      <NumberField name="carbsG" label="Carboidr." suffix="g" defaultValue={goal?.carbsG ? String(goal.carbsG) : ""} />
                      <NumberField name="fatG" label="Gorduras" suffix="g" defaultValue={goal?.fatG ? String(goal.fatG) : ""} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField name="mealsPerDay" label="Refeições/dia" defaultValue={goal?.mealsPerDay ? String(goal.mealsPerDay) : ""} />
                      <TextField name="professionalName" label="Profissional" defaultValue={goal?.professionalName ?? ""} maxLength={80} />
                    </div>
                    <TextAreaField name="notes" label="Observações" defaultValue={goal?.notes ?? ""} maxLength={600} />
                    <FormMessage>Metas próprias abaixo de 1.200 kcal/dia não são aceitas sem orientação profissional.</FormMessage>
                    <SubmitButton block>Salvar meta</SubmitButton>
                  </ActionForm>
                </Dialog>
                {goal && (
                  <ActionForm action={clearGoalAction}>
                    <SubmitButton variant="ghost" size="sm">
                      Remover meta
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </div>
            <details className="mt-4 rounded-3xl border border-line p-5">
              <summary className="cursor-pointer font-semibold">Calculadora educativa de gasto energético</summary>
              <div className="mt-4">
                <EstimateCalculator age={d.age} heightCm={d.heightCm} weightKg={d.weightKg} />
              </div>
            </details>
          </section>

          <section aria-labelledby="config" id="configuracoes" className="scroll-mt-24">
            <SectionTitle id="config">
              <span className="inline-flex items-center gap-2">
                <Palette className="h-5 w-5 text-ink-2" aria-hidden /> Aparência e avisos
              </span>
            </SectionTitle>
            <ActionForm action={saveSettingsAction} className="flex flex-col gap-4">
              <Segmented
                name="theme"
                legend="Tema"
                defaultValue={settings?.theme ?? "DARK"}
                options={[
                  { value: "DARK", label: "Escuro" },
                  { value: "LIGHT", label: "Claro" },
                  { value: "SYSTEM", label: "Sistema" },
                ]}
              />
              <div className="divide-y divide-line rounded-2xl border border-line px-4">
                <Toggle name="animations" label="Animações" description="Desative para uma interface mais estática." defaultChecked={settings?.animations ?? true} />
                <Toggle name="celebrations" label="Celebrações de conquistas" description="Tela comemorativa ao desbloquear algo." defaultChecked={settings?.celebrations ?? true} />
                <Toggle name="notifyMeals" label="Lembretes de refeições" description="Dentro do app, no início." defaultChecked={settings?.notifyMeals ?? false} />
                <Toggle name="notifyWater" label="Lembretes de água" description="Dentro do app, no início." defaultChecked={settings?.notifyWater ?? false} />
                <Toggle name="notifyWorkouts" label="Lembretes de treino" description="Dentro do app, no início." defaultChecked={settings?.notifyWorkouts ?? false} />
                <Toggle name="notifyChallenges" label="Avisos de desafios" description="Dentro do app, no início." defaultChecked={settings?.notifyChallenges ?? false} />
              </div>
              <p className="text-xs text-ink-3">Notificações push ainda não estão disponíveis: os lembretes aparecem apenas dentro do app.</p>
              <SelectField name="timezone" label="Fuso horário" defaultValue={settings?.timezone ?? "America/Sao_Paulo"}>
                {TIMEZONES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </SelectField>
              <SubmitButton variant="secondary">Salvar preferências</SubmitButton>
            </ActionForm>
          </section>

          <section aria-labelledby="privacidade" id="privacidade" className="scroll-mt-24">
            <SectionTitle id="privacidade">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-ink-2" aria-hidden /> Privacidade e dados
              </span>
            </SectionTitle>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-lime-text" aria-hidden /> Assistente com IA
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {aiConfigured
                    ? settings?.assistantAiOptIn
                      ? "Ativado. Perguntas ao assistente são enviadas a um provedor de IA com o mínimo de contexto necessário."
                      : "Desativado. O assistente usa apenas as ferramentas do VIVA, sem enviar dados a terceiros."
                    : "Nenhum provedor de IA está configurado nesta instalação. O assistente funciona só com as ferramentas do VIVA."}
                </p>
                {aiConfigured && (
                  <ActionForm action={setAiOptInAction} className="mt-3">
                    <input type="hidden" name="enable" value={settings?.assistantAiOptIn ? "0" : "1"} />
                    <SubmitButton variant="secondary" size="sm">
                      {settings?.assistantAiOptIn ? "Desativar IA" : "Ativar IA"}
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
              <a href="/api/conta/exportar" className="flex min-h-12 items-center gap-2 rounded-2xl border border-line px-4 font-semibold hover:bg-surface-2">
                <Download className="h-4 w-4" aria-hidden /> Baixar meus dados (JSON)
              </a>
              <details className="text-sm text-ink-2">
                <summary className="cursor-pointer">Consentimentos registrados ({consents.length})</summary>
                <ul className="mt-2 space-y-1">
                  {consents.map((c) => (
                    <li key={c.id}>
                      {{ PRIVACY_POLICY: "Política de privacidade", HEALTH_DATA: "Dados de saúde", AI_PROCESSING: "Uso de IA" }[c.kind]} · versão {c.version} ·{" "}
                      {formatDateBR(c.grantedAt.toISOString().slice(0, 10))}
                      {c.revokedAt ? ` · revogado em ${formatDateBR(c.revokedAt.toISOString().slice(0, 10))}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
              <Link href="/privacidade" className="text-sm font-semibold text-lime-text hover:underline">
                Ler a política de privacidade
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-line px-4 font-semibold hover:bg-surface-2">
                  <LogOut className="h-4 w-4" aria-hidden /> Sair da conta
                </button>
              </form>
              <Dialog
                title="Excluir conta"
                description="Todos os seus dados (perfil, planos, listas, treinos, medidas e histórico) serão apagados de forma definitiva."
                trigger={
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden /> Excluir conta e dados
                  </>
                }
                triggerVariant="danger"
              >
                <ActionForm action={deleteAccountAction} className="flex flex-col gap-4">
                  <FormMessage tone="warning">Esta ação não pode ser desfeita. Se quiser, baixe seus dados antes.</FormMessage>
                  <TextField name="password" type="password" label="Sua senha" autoComplete="current-password" />
                  <TextField name="confirmText" label='Digite "EXCLUIR" para confirmar' autoComplete="off" />
                  <SubmitButton variant="danger" block pendingLabel="Excluindo…">
                    Excluir definitivamente
                  </SubmitButton>
                </ActionForm>
              </Dialog>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
