import { describe, expect, it } from "vitest";
import { isValidBarcode, prefillFromOff } from "@/domain/integrations/open-food-facts";

describe("Open Food Facts → cadastro de alimento", () => {
  it("valida código de barras (EAN-8 a 14 dígitos)", () => {
    expect(isValidBarcode("7891000100103")).toBe(true);
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("78910001001a3")).toBe(false);
  });

  it("usa os valores por 100 g, mapeia alérgenos e traços, e não inventa campos ausentes", () => {
    const p = prefillFromOff("7891000100103", {
      product_name: "Biscoito de chocolate",
      product_name_pt: "Biscoito recheado de chocolate",
      brands: "Marca A, Marca B",
      nutriments: { "energy-kcal_100g": 478.4, proteins_100g: 6.25, carbohydrates_100g: 68, fat_100g: 19.9, "energy-kcal": 999 },
      allergens_tags: ["en:gluten", "en:milk"],
      traces_tags: ["en:peanuts", "en:milk", "en:unknown"],
    });
    expect(p).toEqual({
      barcode: "7891000100103",
      name: "Biscoito recheado de chocolate",
      brand: "Marca A",
      kcal: 478.4,
      proteinG: 6.3,
      carbsG: 68,
      fatG: 19.9,
      fiberG: null,
      allergens: ["gluten", "trigo", "leite", "traco:amendoim"],
      missing: ["fibras"],
    });
  });

  it("converte kJ para kcal quando só há kJ (conversão de unidade)", () => {
    expect(prefillFromOff("12345678", { nutriments: { "energy-kj_100g": 418.4 } }).kcal).toBe(100);
  });

  it("produto sem dados nutricionais fica todo em branco", () => {
    const p = prefillFromOff("12345678", { product_name: "", nutriments: {} });
    expect(p.missing).toEqual(["nome", "energia", "proteínas", "carboidratos", "gorduras", "fibras"]);
  });
});
