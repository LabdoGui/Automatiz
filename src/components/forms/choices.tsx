import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../ui/cn";

/**
 * Opções de múltipla escolha e escolha única baseadas em inputs nativos
 * (funcionam com teclado e leitores de tela, estilizadas por CSS :has()).
 */

export function ChipCheckbox({
  name,
  value,
  label,
  defaultChecked,
  tone = "lime",
  icon,
}: {
  name: string;
  value: string;
  label: ReactNode;
  defaultChecked?: boolean;
  tone?: "lime" | "coral" | "danger";
  icon?: ReactNode;
}) {
  const checked = {
    lime: "has-[:checked]:bg-lime has-[:checked]:text-lime-ink has-[:checked]:border-lime",
    coral: "has-[:checked]:bg-coral has-[:checked]:text-coral-ink has-[:checked]:border-coral",
    danger: "has-[:checked]:bg-danger has-[:checked]:text-white has-[:checked]:border-danger",
  }[tone];
  return (
    <label
      className={cn(
        "relative inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-medium text-ink-2",
        "transition-colors hover:border-ink-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime",
        checked,
      )}
    >
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <Check className="hidden h-3.5 w-3.5 peer-checked:block" aria-hidden />
      {icon}
      {label}
    </label>
  );
}

export function ChipGroup({ legend, hint, children, className }: { legend: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mb-2.5 text-xs text-ink-3">{hint}</p>}
      <div className={cn("flex flex-wrap gap-2", !hint && "mt-2")}>{children}</div>
    </fieldset>
  );
}

export function OptionCard({
  name,
  value,
  title,
  description,
  defaultChecked,
  icon,
  type = "radio",
}: {
  name: string;
  value: string;
  title: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  icon?: ReactNode;
  type?: "radio" | "checkbox";
}) {
  return (
    <label
      className={cn(
        "group relative flex min-h-14 cursor-pointer items-center gap-3.5 rounded-2xl border border-line bg-surface-2 px-4 py-3.5",
        "transition-colors hover:border-line-strong has-[:checked]:border-lime has-[:checked]:bg-lime-soft",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime",
      )}
    >
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2 group-has-[:checked]:bg-lime group-has-[:checked]:text-lime-ink">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-2">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center border-2 border-line-strong text-lime-ink group-has-[:checked]:border-lime group-has-[:checked]:bg-lime",
          type === "radio" ? "rounded-full" : "rounded-lg",
        )}
      >
        <Check className="hidden h-3.5 w-3.5 group-has-[:checked]:block" strokeWidth={3} />
      </span>
    </label>
  );
}

export function Segmented({
  name,
  legend,
  options,
  defaultValue,
  legendHidden,
}: {
  name: string;
  legend: ReactNode;
  options: { value: string; label: ReactNode }[];
  defaultValue?: string;
  legendHidden?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={cn("mb-2 text-sm font-semibold text-ink", legendHidden && "sr-only")}>{legend}</legend>
      <div className="flex rounded-full border border-line bg-surface-2 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold text-ink-2",
              "transition-colors has-[:checked]:bg-ink has-[:checked]:text-bg",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime",
            )}
          >
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-2">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" role="switch" />
        <span className="h-7 w-12 rounded-full bg-surface-3 transition-colors peer-checked:bg-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime" />
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-ink-2 transition-transform peer-checked:translate-x-5 peer-checked:bg-lime-ink" />
      </span>
    </label>
  );
}
