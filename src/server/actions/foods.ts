"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALLERGENS } from "@/domain/restrictions/vocabulary";
import type { ActionResult } from "@/lib/action-types";
import { zDecimal, zOptionalDecimal, zOptionalText, zRequiredText, zStringArray } from "@/lib/validation";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { requireUser } from "../session";
import { createCustomFood } from "../services/foods";

const schema = z.object({
  name: zRequiredText("o nome do alimento", 80),
  brand: zOptionalText(60),
  kcal: zDecimal(0, 900, "a energia por 100 g"),
  proteinG: zDecimal(0, 100, "as proteínas por 100 g"),
  carbsG: zDecimal(0, 100, "os carboidratos por 100 g"),
  fatG: zDecimal(0, 100, "as gorduras por 100 g"),
  fiberG: zOptionalDecimal(0, 100, "as fibras por 100 g"),
  allergens: zStringArray(12).refine((a) => a.every((t) => ALLERGENS.some((x) => x.tag === t)), "Opção inválida."),
});

/** Cadastro de alimento a partir do rótulo (valores por 100 g informados pelo usuário). */
export async function createCustomFoodAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(schema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.proteinG + d.carbsG + d.fatG > 100.5) {
      return { ok: false, error: "A soma de proteínas, carboidratos e gorduras passa de 100 g por 100 g.", fieldErrors: { fatG: ["Confira os valores do rótulo."] } };
    }
    await consumeRateLimit(`custom-food:${user.id}`, 30, 60 * 60);
    try {
      await createCustomFood(user.id, {
        name: d.name,
        brand: d.brand ?? null,
        kcal: d.kcal,
        proteinG: d.proteinG,
        carbsG: d.carbsG,
        fatG: d.fatG,
        fiberG: d.fiberG ?? null,
        tags: d.allergens,
      });
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Limite")) throw new UserFacingError(e.message);
      throw e;
    }
    revalidatePath("/alimentacao/alimentos");
    return { ok: true, message: "Alimento cadastrado. Ele aparece nas buscas como “seu alimento”." };
  });
}
