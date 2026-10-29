"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, ShieldAlert, X } from "lucide-react";
import { useFieldError } from "../forms/action-form";
import { cn } from "../ui/cn";

export interface FoodOption {
  id: string;
  label: string;
  name: string;
  state: string;
  kcal: number | null;
  proteinG: number | null;
  incomplete: boolean;
  reviewed: boolean;
  own: boolean;
  conflicts: { level: "critical" | "preference"; label: string }[];
}

/**
 * Campo de busca de alimentos (padrão combobox ARIA).
 * Envia o id escolhido em um input oculto com o nome `name`.
 */
export function FoodPicker({
  name = "foodId",
  label = "Alimento",
  placeholder = "Busque: arroz, frango, banana…",
  onSelect,
  initial,
  hideLabel,
}: {
  name?: string;
  label?: string;
  placeholder?: string;
  onSelect?: (food: FoodOption | null) => void;
  initial?: { id: string; label: string } | null;
  hideLabel?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(initial ?? null);
  const [selectedFull, setSelectedFull] = useState<FoodOption | null>(null);
  const error = useFieldError(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/alimentos?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { results: FoodOption[] };
        setResults(json.results);
        setActive(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  function choose(option: FoodOption) {
    setSelected({ id: option.id, label: option.label });
    setSelectedFull(option);
    setOpen(false);
    setQuery("");
    onSelect?.(option);
  }

  function clear() {
    setSelected(null);
    setSelectedFull(null);
    onSelect?.(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const visible = query.trim().length < 2 ? [] : results;
  const critical = selectedFull?.conflicts.filter((c) => c.level === "critical") ?? [];
  const preference = selectedFull?.conflicts.filter((c) => c.level === "preference") ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-sm font-semibold", hideLabel && "sr-only")}>
        {label}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-lime bg-lime-soft px-4 py-2">
          <span className="flex-1 font-semibold">{selected.label}</span>
          <button type="button" onClick={clear} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Trocar alimento">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open && visible.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => visible.length > 0 && setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, visible.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && open && visible[active]) {
                e.preventDefault();
                choose(visible[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="h-12 w-full rounded-2xl border border-line bg-surface-2 pr-10 pl-11 text-[1rem] focus:border-lime focus:bg-surface focus:outline-none aria-[invalid=true]:border-danger"
          />
          {loading && <Loader2 className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin text-ink-3" aria-hidden />}
          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Resultados"
              className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-line-strong bg-surface p-1 shadow-lift"
            >
              {visible.length === 0 && !loading && <li className="px-3 py-3 text-sm text-ink-2">Nenhum alimento encontrado.</li>}
              {visible.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("cursor-pointer rounded-xl px-3 py-2.5", i === active && "bg-surface-2")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.label}</span>
                    {r.conflicts.some((c) => c.level === "critical") && <ShieldAlert className="h-4 w-4 text-danger-text" aria-label="Conflita com suas restrições" />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {r.kcal !== null ? `${Math.round(r.kcal)} kcal/100 g` : "energia indisponível"} · {r.state}
                    {r.own ? " · seu alimento" : ""}
                    {r.incomplete ? " · dados incompletos" : ""}
                    {!r.reviewed && !r.own ? " · alergênicos não revisados" : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {failed && <p className="text-xs text-danger-text">Não foi possível buscar agora. Tente de novo.</p>}
      {error && <p className="text-xs font-medium text-danger-text">{error}</p>}
      {critical.length > 0 && (
        <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-text" role="alert">
          <p className="font-semibold">Atenção: conflita com {critical.map((c) => c.label).join(", ")}.</p>
          <label className="mt-2 flex items-center gap-2 text-ink">
            <input type="checkbox" name="confirm" className="h-5 w-5 accent-[var(--danger)]" />
            Entendo o risco e quero adicionar mesmo assim
          </label>
        </div>
      )}
      {critical.length === 0 && preference.length > 0 && (
        <p className="text-xs text-amber-text">Você marcou que prefere evitar: {preference.map((c) => c.label).join(", ")}.</p>
      )}
    </div>
  );
}
