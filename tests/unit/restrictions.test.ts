import { describe, expect, it } from "vitest";
import {
  buildRules,
  foodConflicts,
  hasCriticalConflict,
  isFavorite,
  isFoodAllowed,
  normalizeText,
  recipeConflicts,
  type RestrictionFood,
} from "@/domain/restrictions/engine";

const food = (name: string, tags: string[], family: string | null = null, reviewed = true): RestrictionFood => ({
  name,
  tags,
  family,
  allergenReviewed: reviewed,
});

const queijo = food("Queijo, minas, frescal", ["leite", "lactose", "laticinio", "origem-animal"], "queijo");
const paoForma = food("Pão, trigo, forma, integral", ["trigo", "gluten", "traco:leite", "traco:soja"], "pao");
const frango = food("Frango, peito, sem pele, grelhado", ["carne", "aves", "origem-animal"], "frango");
const atum = food("Atum, conserva em óleo", ["peixe", "carne", "origem-animal"], "peixe");
const banana = food("Banana, prata, crua", [], "banana");
const amendoim = food("Amendoim, torrado, salgado", ["amendoim"], "amendoim");
const ovo = food("Ovo, de galinha, inteiro, cozido", ["ovo", "origem-animal"], "ovo");
const lentilha = food("Lentilha, cozida", [], "lentilha");
const naoRevisado = food("Bolo, pronto, chocolate", [], null, false);

describe("alergias (críticas)", () => {
  const rules = buildRules([{ kind: "ALLERGY", tag: "leite", label: "Leite" }]);

  it("bloqueia o alergênico direto", () => {
    expect(isFoodAllowed(queijo, rules)).toBe(false);
    expect(hasCriticalConflict(foodConflicts(queijo, rules))).toBe(true);
  });

  it("bloqueia produtos que podem conter traços", () => {
    expect(isFoodAllowed(paoForma, rules)).toBe(false);
  });

  it("bloqueia alimentos sem revisão de alergênicos para quem tem alergia", () => {
    expect(isFoodAllowed(naoRevisado, rules)).toBe(false);
  });

  it("permite alimentos seguros", () => {
    expect(isFoodAllowed(banana, rules)).toBe(true);
    expect(isFoodAllowed(frango, rules)).toBe(true);
  });

  it("alergia em texto livre é comparada com o nome", () => {
    const r = buildRules([{ kind: "ALLERGY", tag: null, label: "Banana" }]);
    expect(isFoodAllowed(banana, r)).toBe(false);
    expect(isFoodAllowed(frango, r)).toBe(true);
  });
});

describe("intolerâncias e dietas", () => {
  it("intolerância à lactose não bloqueia traços de leite", () => {
    const r = buildRules([{ kind: "INTOLERANCE", tag: "lactose", label: "Lactose" }]);
    expect(isFoodAllowed(queijo, r)).toBe(false);
    expect(isFoodAllowed(paoForma, r)).toBe(true);
  });

  it("vegetariana exclui carnes, aves e peixes, mas permite ovos e laticínios", () => {
    const r = buildRules([{ kind: "RESTRICTION", tag: "vegetariano", label: "Vegetariana" }]);
    expect(isFoodAllowed(frango, r)).toBe(false);
    expect(isFoodAllowed(atum, r)).toBe(false);
    expect(isFoodAllowed(ovo, r)).toBe(true);
    expect(isFoodAllowed(queijo, r)).toBe(true);
  });

  it("vegana exclui qualquer ingrediente de origem animal", () => {
    const r = buildRules([{ kind: "RESTRICTION", tag: "vegano", label: "Vegana" }]);
    expect(isFoodAllowed(ovo, r)).toBe(false);
    expect(isFoodAllowed(queijo, r)).toBe(false);
    expect(isFoodAllowed(lentilha, r)).toBe(true);
  });

  it("glúten bloqueia pães de trigo", () => {
    const r = buildRules([{ kind: "INTOLERANCE", tag: "gluten", label: "Glúten" }]);
    expect(isFoodAllowed(paoForma, r)).toBe(false);
  });
});

describe("preferências pessoais", () => {
  it("aversão é tratada como preferência, não como risco", () => {
    const r = buildRules([{ kind: "DISLIKE", tag: "banana", label: "Banana" }]);
    const conflicts = foodConflicts(banana, r);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].level).toBe("preference");
    expect(hasCriticalConflict(conflicts)).toBe(false);
  });

  it("ingrediente evitado em texto livre", () => {
    const r = buildRules([{ kind: "AVOID", tag: null, label: "amendoim" }]);
    expect(isFoodAllowed(amendoim, r)).toBe(false);
  });

  it("não confunde palavras curtas com partes de outras palavras", () => {
    const r = buildRules([{ kind: "AVOID", tag: null, label: "ovo" }]);
    expect(isFoodAllowed(food("Pão, de queijo, assado", []), r)).toBe(true);
    expect(isFoodAllowed(ovo, r)).toBe(false);
  });

  it("identifica favoritos", () => {
    const r = buildRules([{ kind: "FAVORITE", tag: "frango", label: "Frango" }]);
    expect(isFavorite(frango, r)).toBe(true);
    expect(isFavorite(banana, r)).toBe(false);
  });
});

describe("receitas", () => {
  it("lista conflitos únicos de todos os ingredientes", () => {
    const r = buildRules([
      { kind: "ALLERGY", tag: "leite", label: "Leite" },
      { kind: "DISLIKE", tag: "banana", label: "Banana" },
    ]);
    const c = recipeConflicts([queijo, paoForma, banana], r);
    expect(c.map((x) => x.label).sort()).toEqual(["Banana", "Leite"]);
  });
});

describe("normalizeText", () => {
  it("remove acentos e pontuação", () => {
    expect(normalizeText("Pão, Francês!")).toBe("pao frances");
  });
});
