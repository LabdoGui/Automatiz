import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formDataToObject, zBool, zDecimal, zId, zInt, zISODate, zMoneyCents, zOptionalText, zStringArray, zTime } from "@/lib/validation";

const msg = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? null : r.error.issues[0].message;
};

describe("validação de entradas (pt-BR)", () => {
  it("dinheiro em reais vira centavos inteiros", () => {
    const s = zMoneyCents("o preço");
    expect(s.parse("12,90")).toBe(1290);
    expect(s.parse("R$ 1.234,56")).toBe(123456);
    expect(s.parse("7")).toBe(700);
    expect(msg(s, "")).toBe("Informe o preço.");
    expect(msg(s, "abc")).toMatch(/Valor inválido para o preço/);
    expect(msg(s, "-3,00")).toMatch(/não pode ser negativo|inválido/);
  });

  it("decimais aceitam vírgula e respeitam limites", () => {
    const s = zDecimal(0, 300, "o peso");
    expect(s.parse("70,5")).toBe(70.5);
    expect(s.parse("70.5")).toBe(70.5);
    expect(msg(s, "301")).toBe("O máximo para o peso é 300.");
    expect(msg(s, "x")).toMatch(/Valor inválido para o peso/);
    expect(msg(s, "")).toBe("Informe o peso.");
  });

  it("inteiros rejeitam frações e valores fora do intervalo", () => {
    const s = zInt(1, 7, "os dias");
    expect(s.parse("3")).toBe(3);
    expect(msg(s, "2,5")).toBe("Use um número inteiro para os dias.");
    expect(msg(s, "9")).toBe("O máximo para os dias é 7.");
  });

  it("datas, horários, ids, booleanos e listas", () => {
    expect(zISODate.safeParse("2026-02-30").success).toBe(false);
    expect(zISODate.safeParse("2026-10-29").success).toBe(true);
    expect(zTime.safeParse("24:00").success).toBe(false);
    expect(zTime.safeParse("07:30").success).toBe(true);
    expect(zId.safeParse("abc_123-x").success).toBe(true);
    expect(zId.safeParse("1; DROP TABLE").success).toBe(false);
    expect(zBool.parse("on")).toBe(true);
    expect(zBool.parse(undefined)).toBe(false);
    expect(zStringArray(2).safeParse(["a", "b", "c"]).success).toBe(false);
    expect(zOptionalText(5).parse("   ")).toBeUndefined();
    expect(msg(zOptionalText(5), "texto longo")).toBe("Use no máximo 5 caracteres.");
  });

  it("FormData: campos repetidos viram lista e campos internos do Next são ignorados", () => {
    const fd = new FormData();
    fd.append("foodId", "a");
    fd.append("foodId", "b");
    fd.append("$ACTION_ID_123", "x");
    fd.append("name", "Arroz");
    expect(formDataToObject(fd)).toEqual({ foodId: ["a", "b"], name: "Arroz" });
  });
});
