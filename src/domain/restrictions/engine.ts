import { DIET_RESTRICTIONS } from "./vocabulary";

/**
 * Motor de restrições.
 *
 * - "critical": alergias, intolerâncias e restrições alimentares. Nunca são
 *   violadas por sugestões automáticas.
 * - "preference": aversões, ingredientes evitados por gosto. Também são
 *   respeitadas pelo gerador, mas tratadas com linguagem diferente na interface.
 */

export type PreferenceKind = "FAVORITE" | "DISLIKE" | "AVOID" | "ALLERGY" | "INTOLERANCE" | "RESTRICTION";

export interface PreferenceInput {
  kind: PreferenceKind;
  tag: string | null;
  label: string;
}

export interface RestrictionFood {
  name: string;
  tags: readonly string[];
  family: string | null;
  allergenReviewed: boolean;
}

export type ConflictLevel = "critical" | "preference";

export interface Conflict {
  level: ConflictLevel;
  kind: PreferenceKind;
  label: string;
}

interface Rule {
  kind: PreferenceKind;
  label: string;
  level: ConflictLevel;
  tags: string[];
  text: string | null;
}

export interface ExclusionRules {
  rules: Rule[];
  favorites: { tags: string[]; text: string[] };
  /** Há alguma alergia registrada (exige alimentos com alergênicos revisados) */
  hasAllergy: boolean;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tags excluídas por uma alergia: o alergênico e seus traços. */
function allergyTags(tag: string): string[] {
  const base = [tag, `traco:${tag}`];
  if (tag === "crustaceo") base.push("frutos-do-mar");
  return base;
}

export function buildRules(prefs: readonly PreferenceInput[]): ExclusionRules {
  const rules: Rule[] = [];
  const favorites = { tags: [] as string[], text: [] as string[] };
  let hasAllergy = false;

  for (const p of prefs) {
    const text = p.tag ? null : normalizeText(p.label);
    switch (p.kind) {
      case "FAVORITE":
        if (p.tag) favorites.tags.push(p.tag);
        else if (text) favorites.text.push(text);
        break;
      case "ALLERGY":
        hasAllergy = true;
        rules.push({ kind: p.kind, label: p.label, level: "critical", tags: p.tag ? allergyTags(p.tag) : [], text });
        break;
      case "INTOLERANCE":
        rules.push({ kind: p.kind, label: p.label, level: "critical", tags: p.tag ? [p.tag] : [], text });
        break;
      case "RESTRICTION": {
        const def = DIET_RESTRICTIONS.find((r) => r.tag === p.tag);
        rules.push({
          kind: p.kind,
          label: p.label,
          level: "critical",
          tags: def ? [...def.excludes] : [],
          text: def ? null : text,
        });
        break;
      }
      case "DISLIKE":
      case "AVOID":
        rules.push({ kind: p.kind, label: p.label, level: "preference", tags: p.tag ? [p.tag] : [], text });
        break;
    }
  }
  return { rules, favorites, hasAllergy };
}

function matchesText(food: RestrictionFood, text: string): boolean {
  if (!text) return false;
  const name = normalizeText(food.name);
  const family = food.family ? normalizeText(food.family) : "";
  // Correspondência por palavra inteira ou prefixo de palavra ("banana" → "Banana, prata").
  const words = name.split(" ");
  const needle = text.split(" ");
  if (family && family === text) return true;
  if (needle.length === 1) return words.some((w) => w === text || (text.length >= 4 && w.startsWith(text)));
  return ` ${name} `.includes(` ${text} `);
}

export function foodConflicts(food: RestrictionFood, rules: ExclusionRules): Conflict[] {
  const conflicts: Conflict[] = [];
  const tags = new Set(food.tags);
  if (food.family) tags.add(food.family);
  for (const rule of rules.rules) {
    const tagHit = rule.tags.some((t) => tags.has(t));
    const textHit = rule.text !== null && matchesText(food, rule.text);
    if (tagHit || textHit) conflicts.push({ level: rule.level, kind: rule.kind, label: rule.label });
  }
  // Alimentos sem revisão de alergênicos não são sugeridos para quem tem alergia.
  if (rules.hasAllergy && !food.allergenReviewed) {
    conflicts.push({
      level: "critical",
      kind: "ALLERGY",
      label: "Alergênicos deste alimento ainda não foram revisados",
    });
  }
  return conflicts;
}

export function isFoodAllowed(food: RestrictionFood, rules: ExclusionRules): boolean {
  return foodConflicts(food, rules).length === 0;
}

export function hasCriticalConflict(conflicts: readonly Conflict[]): boolean {
  return conflicts.some((c) => c.level === "critical");
}

export function recipeConflicts(foods: readonly RestrictionFood[], rules: ExclusionRules): Conflict[] {
  const seen = new Set<string>();
  const out: Conflict[] = [];
  for (const food of foods) {
    for (const c of foodConflicts(food, rules)) {
      const key = `${c.level}:${c.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
  }
  return out;
}

export function isFavorite(food: RestrictionFood, rules: ExclusionRules): boolean {
  const tags = new Set(food.tags);
  if (food.family) tags.add(food.family);
  return (
    rules.favorites.tags.some((t) => tags.has(t)) || rules.favorites.text.some((t) => matchesText(food, t))
  );
}
