import type { ReactNode } from "react";

/** Anel de progresso em SVG. `value` de 0 a 1 (valores acima de 1 aparecem cheios). */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "var(--lime)",
  track = "var(--surface-3)",
  label,
  children,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ ["--ring-length" as string]: `${c}`, animation: "ring-draw 0.9s cubic-bezier(.2,.8,.2,1) both" }}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}
