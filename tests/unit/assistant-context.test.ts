import { describe, expect, it } from "vitest";
import { buildAssistantContext } from "@/domain/assistant/context";

const empty = {
  goal: null,
  experienceLevel: null,
  trainingLocation: null,
  cookingStyle: null,
  cookingMinutes: null,
  allergies: [],
  intolerances: [],
  restrictions: [],
  dislikes: [],
} as const;

describe("contexto mínimo do assistente", () => {
  it("sem dados, não envia nada", () => {
    expect(buildAssistantContext(empty)).toEqual([]);
  });

  it("descreve objetivo, treino, cozinha e restrições, com alergias destacadas", () => {
    const lines = buildAssistantContext({
      goal: "GAIN_MUSCLE",
      experienceLevel: "BEGINNER",
      trainingLocation: "HOME",
      cookingStyle: "QUICK",
      cookingMinutes: 20,
      allergies: ["Amendoim"],
      intolerances: ["Lactose"],
      restrictions: ["Vegetariana"],
      dislikes: ["Jiló"],
    });
    expect(lines).toEqual([
      "Objetivo: Ganho de massa",
      "Treino: nível iniciante, em casa",
      "Cozinha: prefere receitas rápidas, até 20 min para cozinhar",
      "Alergias (evitar totalmente, inclusive traços): Amendoim",
      "Intolerâncias: Lactose",
      "Restrições alimentares: Vegetariana",
      "Não come por preferência: Jiló",
    ]);
  });

  it("limita, deduplica e sanitiza listas de texto livre", () => {
    const dislikes = Array.from({ length: 20 }, (_, i) => `item ${i}`);
    const [line] = buildAssistantContext({ ...empty, dislikes: [...dislikes, "item 0", "quebra\nde linha"] });
    expect(line).toContain("item 14");
    expect(line).not.toContain("item 15,");
    expect(line).toMatch(/e mais 6$/);
    expect(line).not.toContain("\n");
  });

  it("a interface de entrada não aceita dados pessoais (nome, idade, peso)", () => {
    const lines = buildAssistantContext({ ...empty, goal: "HABITS" }).join(" ");
    expect(lines).not.toMatch(/kg|anos|cm|@/);
  });
});
