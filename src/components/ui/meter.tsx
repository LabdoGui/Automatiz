import { cn } from "./cn";

/** Barra de progresso linear acessível. */
export function Meter({
  value,
  label,
  tone = "lime",
  className,
  height = "h-2.5",
}: {
  value: number;
  label: string;
  tone?: "lime" | "coral" | "sky" | "amber" | "danger";
  className?: string;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = {
    lime: "bg-lime",
    coral: "bg-coral",
    sky: "bg-sky",
    amber: "bg-amber",
    danger: "bg-danger",
  }[tone];
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", height, className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
