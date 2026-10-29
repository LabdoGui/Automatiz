import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  title,
  eyebrow,
  description,
  backHref,
  backLabel = "Voltar",
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 animate-rise", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-lime-text">{eyebrow}</p>}
          <h1 className="text-[1.85rem] leading-[1.05] font-extrabold sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[0.95rem] text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-bold">
        {children}
      </h2>
      {action}
    </div>
  );
}
