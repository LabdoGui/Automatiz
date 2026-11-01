"use client";

import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import type { FoodPrefill } from "@/domain/integrations/open-food-facts";
import { ALLERGENS } from "@/domain/restrictions/vocabulary";
import { ActionForm, FormMessage } from "../forms/action-form";
import { NumberField, SubmitButton, TextField } from "../forms/fields";
import { ChipCheckbox, ChipGroup } from "../forms/choices";
import { Button } from "../ui/button";
import { createCustomFoodAction, lookupBarcodeAction } from "@/server/actions/foods";

const num = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

/**
 * Cadastro de alimento personalizado. Opcionalmente pré-preenchido pelo
 * código de barras (Open Food Facts); a pessoa confere tudo no rótulo.
 */
export function CustomFoodForm({ barcodeEnabled }: { barcodeEnabled: boolean }) {
  const [code, setCode] = useState("");
  const [prefill, setPrefill] = useState<FoodPrefill | null>(null);
  const [version, setVersion] = useState(0);
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "notfound" | "error"; message?: string }>({ state: "idle" });

  async function search() {
    setLookup({ state: "loading" });
    const res = await lookupBarcodeAction(code);
    if (!res.ok) return setLookup({ state: "error", message: res.error });
    if (!res.data?.prefill) return setLookup({ state: "notfound" });
    setPrefill(res.data.prefill);
    setVersion((v) => v + 1);
    setLookup({ state: "idle" });
  }

  return (
    <div className="flex flex-col gap-4">
      {barcodeEnabled && (
        <div className="rounded-2xl border border-line p-3">
          <div className="flex items-end gap-2">
            <TextField
              name="lookupBarcode"
              label="Código de barras (opcional)"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={search} disabled={code.length < 8 || lookup.state === "loading"}>
              <ScanBarcode className="h-4 w-4" aria-hidden /> {lookup.state === "loading" ? "Buscando…" : "Buscar"}
            </Button>
          </div>
          <p role="status" className="mt-2 text-xs text-ink-2">
            {lookup.state === "notfound" && "Produto não encontrado no Open Food Facts. Preencha pelo rótulo."}
            {lookup.state === "error" && lookup.message}
            {lookup.state === "idle" &&
              (prefill
                ? `Dados do Open Food Facts (comunidade, licença ODbL). Confira tudo no rótulo antes de salvar${prefill.missing.length ? ` — faltou: ${prefill.missing.join(", ")}` : ""}.`
                : "Busca os dados do rótulo no Open Food Facts, base aberta e colaborativa.")}
          </p>
        </div>
      )}

      <ActionForm key={version} action={createCustomFoodAction} closeDialogOnSuccess className="flex flex-col gap-4">
        {prefill && <input type="hidden" name="barcode" value={prefill.barcode} />}
        <TextField name="name" label="Nome" maxLength={80} defaultValue={prefill?.name ?? ""} />
        <TextField name="brand" label="Marca (opcional)" maxLength={60} defaultValue={prefill?.brand ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="kcal" label="Energia" decimal suffix="kcal" defaultValue={num(prefill?.kcal ?? null)} />
          <NumberField name="proteinG" label="Proteínas" decimal suffix="g" defaultValue={num(prefill?.proteinG ?? null)} />
          <NumberField name="carbsG" label="Carboidratos" decimal suffix="g" defaultValue={num(prefill?.carbsG ?? null)} />
          <NumberField name="fatG" label="Gorduras" decimal suffix="g" defaultValue={num(prefill?.fatG ?? null)} />
          <NumberField name="fiberG" label="Fibras (opcional)" decimal suffix="g" defaultValue={num(prefill?.fiberG ?? null)} />
        </div>
        <ChipGroup legend="Contém alergênicos?" hint="Marque conforme o rótulo.">
          {ALLERGENS.map((a) => (
            <ChipCheckbox key={a.tag} name="allergens" value={a.tag} label={a.label} tone="danger" defaultChecked={prefill?.allergens.includes(a.tag)} />
          ))}
        </ChipGroup>
        <ChipGroup legend="Pode conter (traços)?" hint="O “pode conter” do rótulo também é tratado como risco para quem tem alergia.">
          {ALLERGENS.map((a) => (
            <ChipCheckbox
              key={a.tag}
              name="allergens"
              value={`traco:${a.tag}`}
              label={a.label}
              tone="danger"
              defaultChecked={prefill?.allergens.includes(`traco:${a.tag}`)}
            />
          ))}
        </ChipGroup>
        <FormMessage>Todos os valores são por 100 g do produto. Se o rótulo mostrar por porção, converta antes.</FormMessage>
        <SubmitButton block>Salvar alimento</SubmitButton>
      </ActionForm>
    </div>
  );
}
