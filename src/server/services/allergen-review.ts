import "server-only";
import { isReviewTag, mergeReviewedTags, suggestAllergens } from "@/domain/restrictions/allergen-suggestions";
import { db } from "../db";
import { parseCsv } from "./prices";

/**
 * Revisão de alergênicos dos alimentos da TACO por um(a) profissional:
 * exporta uma planilha com sugestões e importa as linhas revisadas.
 * A chave é o código da TACO (estável entre instalações).
 */
export const REVIEW_HEADER = ["taco_id", "alimento", "categoria", "sugestao", "alergenicos_confirmados", "revisado_por", "observacoes"];

const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function exportAllergenReview(): Promise<{ csv: string; rows: number }> {
  const foods = await db.food.findMany({
    where: { ownerId: null, allergenReviewed: false, sourceRef: { not: null } },
    select: { sourceRef: true, name: true, category: true, tags: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const lines = [REVIEW_HEADER.join(";")];
  for (const f of foods) {
    // Sugestão = alergênicos já inferidos na base + regras por nome (sempre a conferir).
    const suggestion = [...new Set([...f.tags.filter(isReviewTag), ...suggestAllergens(f.name, f.category)])];
    lines.push([f.sourceRef!, f.name, f.category, suggestion.join(", "), "", "", ""].map(csvCell).join(";"));
  }
  return { csv: "﻿" + lines.join("\n") + "\n", rows: foods.length };
}

export interface ReviewReport {
  applied: number;
  pending: number;
  errors: { line: number; message: string }[];
  changes: { tacoId: string; name: string; tags: string[] }[];
}

export async function importAllergenReview(text: string, opts: { apply: boolean; today: string }): Promise<ReviewReport> {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name: string) => header.indexOf(name);
  const [iId, iTags, iWho, iObs] = [col("taco_id"), col("alergenicos_confirmados"), col("revisado_por"), col("observacoes")];
  if (iId < 0 || iTags < 0 || iWho < 0) throw new Error("Planilha sem as colunas taco_id, alergenicos_confirmados e revisado_por.");

  const report: ReviewReport = { applied: 0, pending: 0, errors: [], changes: [] };
  for (let i = 1; i < rows.length; i++) {
    const line = i + 1;
    const r = rows[i];
    const who = (r[iWho] ?? "").trim();
    if (!who) {
      report.pending++;
      continue;
    }
    const raw = (r[iTags] ?? "").trim().toLowerCase();
    if (!raw) {
      report.errors.push({ line, message: "Revisado, mas sem alergênicos confirmados (use “nenhum” se não houver)." });
      continue;
    }
    const tags = raw === "nenhum" ? [] : [...new Set(raw.split(/[,\s]+/).filter(Boolean))];
    const invalid = tags.filter((t) => !isReviewTag(t));
    if (invalid.length) {
      report.errors.push({ line, message: `Tag desconhecida: ${invalid.join(", ")}.` });
      continue;
    }
    const tacoId = (r[iId] ?? "").trim();
    const food = await db.food.findFirst({ where: { ownerId: null, sourceRef: tacoId }, select: { id: true, name: true, tags: true } });
    if (!food) {
      report.errors.push({ line, message: `Alimento ${tacoId} não encontrado.` });
      continue;
    }
    const obs = iObs >= 0 ? (r[iObs] ?? "").trim().slice(0, 200) : "";
    const merged = mergeReviewedTags(food.tags, tags);
    report.changes.push({ tacoId, name: food.name, tags });
    if (opts.apply) {
      await db.food.update({
        where: { id: food.id },
        data: {
          tags: merged,
          allergenReviewed: true,
          allergenReviewNote: `Revisado por ${who.slice(0, 80)} em ${opts.today}${obs ? ` — ${obs}` : ""}`,
        },
      });
    }
    report.applied++;
  }
  return report;
}
