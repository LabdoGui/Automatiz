import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "lime" | "coral" | "sky" | "amber" | "danger" | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  lime: "bg-lime-soft text-lime-text",
  coral: "bg-coral-soft text-coral-text",
  sky: "bg-sky-soft text-sky-text",
  amber: "bg-amber-soft text-amber-text",
  danger: "bg-danger-soft text-danger-text",
  outline: "border border-line-strong text-ink-2",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
