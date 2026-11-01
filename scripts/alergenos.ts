/**
 * Revisão de alergênicos da base TACO (para nutricionistas).
 *
 *   npm run alergenos:exportar -- [arquivo.csv]          gera a planilha com sugestões
 *   npm run alergenos:importar -- arquivo.csv            mostra o que mudaria (simulação)
 *   npm run alergenos:importar -- arquivo.csv --aplicar  grava as revisões
 *
 * Preencha "alergenicos_confirmados" (ex.: "leite, lactose, traco:amendoim" ou "nenhum")
 * e "revisado_por" (nome e registro profissional). Linhas sem revisor são ignoradas.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/server/db";
import { exportAllergenReview, importAllergenReview } from "../src/server/services/allergen-review";

async function main() {
  const [command, file, flag] = process.argv.slice(2);
  if (command === "exportar") {
    const out = file ?? "revisao-alergenos.csv";
    const { csv, rows } = await exportAllergenReview();
    writeFileSync(out, csv);
    console.log(`${rows} alimentos aguardando revisão → ${out}`);
    console.log("As sugestões são automáticas e precisam ser conferidas; nada é marcado como revisado sem revisor.");
    return;
  }
  if (command === "importar" && file) {
    const apply = flag === "--aplicar";
    const report = await importAllergenReview(readFileSync(file, "utf8"), { apply, today: new Date().toISOString().slice(0, 10) });
    for (const c of report.changes) console.log(`  ${c.tacoId} ${c.name}: ${c.tags.length ? c.tags.join(", ") : "nenhum alergênico"}`);
    for (const e of report.errors) console.log(`  linha ${e.line}: ${e.message}`);
    console.log(
      `${apply ? "Gravados" : "Seriam gravados"}: ${report.applied} · pendentes: ${report.pending} · com erro: ${report.errors.length}` +
        (apply ? "" : "\nNada foi gravado. Rode de novo com --aplicar para salvar."),
    );
    return;
  }
  console.log("Uso: alergenos.ts exportar [arquivo.csv] | importar <arquivo.csv> [--aplicar]");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
