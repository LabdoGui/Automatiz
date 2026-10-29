"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { importPricesAction } from "@/server/actions/shopping";
import { ActionForm } from "../forms/action-form";
import { SubmitButton } from "../forms/fields";

export function ImportPricesForm() {
  const [report, setReport] = useState<{ imported: number; errors: { line: number; message: string }[] } | null>(null);
  return (
    <ActionForm action={importPricesAction} resetOnSuccess onSuccess={(r) => setReport(r.data ?? null)} className="flex flex-col gap-3">
      <label htmlFor="csv" className="text-sm font-semibold">
        Arquivo CSV (até 500 linhas)
      </label>
      <input
        id="csv"
        name="file"
        type="file"
        accept=".csv,text/csv,text/plain"
        className="block w-full rounded-2xl border border-dashed border-line-strong bg-surface-2 p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-lime file:px-4 file:py-2 file:font-semibold file:text-lime-ink"
      />
      <p className="text-xs text-ink-3">
        Colunas: <code>produto;preco;loja;data</code>. O produto deve ter o mesmo nome da lista de preços abaixo. Datas no formato
        DD/MM/AAAA.{" "}
        <a href="/modelo-precos.csv" download className="font-semibold text-lime-text underline">
          Baixar modelo
        </a>
      </p>
      <SubmitButton variant="secondary" pendingLabel="Importando…">
        <FileUp className="h-4 w-4" aria-hidden /> Importar preços
      </SubmitButton>
      {report && report.errors.length > 0 && (
        <div className="rounded-2xl bg-amber-soft p-3 text-sm" role="status">
          <p className="font-semibold text-amber-text">Linhas não importadas:</p>
          <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-ink">
            {report.errors.slice(0, 30).map((e) => (
              <li key={e.line}>
                Linha {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ActionForm>
  );
}
