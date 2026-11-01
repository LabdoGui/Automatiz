import { describe, expect, it } from "vitest";
import { isReviewTag, mergeReviewedTags, suggestAllergens } from "@/domain/restrictions/allergen-suggestions";

describe("revisão de alergênicos", () => {
  it("sugere alergênicos pelo nome do alimento", () => {
    expect(suggestAllergens("Queijo, minas, frescal", "Leite e derivados")).toEqual(["leite", "lactose"]);
    expect(suggestAllergens("Pão, trigo, francês", "Cereais e derivados")).toEqual(["trigo", "gluten"]);
    expect(suggestAllergens("Bife à cavalo, com contra filé", "Alimentos preparados")).toEqual(["ovo"]);
    expect(suggestAllergens("Acarajé", "Alimentos preparados")).toEqual(["crustaceo"]);
    expect(suggestAllergens("Banana, prata, crua", "Frutas e derivados")).toEqual([]);
  });

  it("aceita só tags do vocabulário (incluindo traços)", () => {
    expect(isReviewTag("amendoim")).toBe(true);
    expect(isReviewTag("lactose")).toBe(true);
    expect(isReviewTag("traco:castanhas")).toBe(true);
    expect(isReviewTag("traco:lactose")).toBe(false);
    expect(isReviewTag("carne")).toBe(false);
  });

  it("troca só as tags de alergênico, preservando dieta e família", () => {
    expect(mergeReviewedTags(["carne", "origem-animal", "leite"], ["ovo", "traco:leite"])).toEqual(["carne", "origem-animal", "ovo", "traco:leite"]);
    expect(mergeReviewedTags(["gluten", "trigo", "cereal"], [])).toEqual(["cereal"]);
  });
});
