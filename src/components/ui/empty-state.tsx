import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-lime-soft text-lime-text">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
