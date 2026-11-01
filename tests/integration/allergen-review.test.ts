import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { exportAllergenReview, importAllergenReview } from "@/server/services/allergen-review";

describe("planilha de revisão de alergênicos", () => {
  it("exporta os alimentos ainda não revisados com sugestões", async () => {
    const { csv, rows } = await exportAllergenReview();
    expect(rows).toBeGreaterThan(100);
    expect(csv.split("\n")[0]).toBe("﻿taco_id;alimento;categoria;sugestao;alergenicos_confirmados;revisado_por;observacoes");
  });

  it("simulação não grava; aplicação grava tags, revisão e quem revisou", async () => {
    const food = await db.food.findFirstOrThrow({ where: { ownerId: null, allergenReviewed: false, sourceRef: { not: null } }, orderBy: { name: "asc" } });
    const original = { tags: food.tags, allergenReviewed: food.allergenReviewed, allergenReviewNote: food.allergenReviewNote };
    const csv = [
      "taco_id;alimento;categoria;sugestao;alergenicos_confirmados;revisado_por;observacoes",
      `${food.sourceRef};${food.name};${food.category};;leite, traco:amendoim;Nutri Teste CRN 0000;conferido em rótulos`,
      "1;x;y;;;;",
      "2;x;y;;;Nutri Teste;",
      "3;x;y;;veneno;Nutri Teste;",
      "999999;x;y;;nenhum;Nutri Teste;",
    ].join("\n");
    try {
      const dry = await importAllergenReview(csv, { apply: false, today: "2026-11-01" });
      expect(dry.applied).toBe(1);
      expect(dry.pending).toBe(1);
      expect(dry.errors.map((e) => e.line)).toEqual([4, 5, 6]);
      expect((await db.food.findUniqueOrThrow({ where: { id: food.id } })).allergenReviewed).toBe(false);

      await importAllergenReview(csv, { apply: true, today: "2026-11-01" });
      const after = await db.food.findUniqueOrThrow({ where: { id: food.id } });
      expect(after.allergenReviewed).toBe(true);
      expect(after.tags).toEqual(expect.arrayContaining(["leite", "traco:amendoim"]));
      expect(after.allergenReviewNote).toBe("Revisado por Nutri Teste CRN 0000 em 2026-11-01 — conferido em rótulos");
    } finally {
      await db.food.update({ where: { id: food.id }, data: original });
    }
  });
});
