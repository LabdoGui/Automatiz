import { cn } from "../ui/cn";

/** Folha usada como "pingo do i" do logotipo e no ícone do app. */
export function Leaf({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M4 20C4 10 10 4 21 3c-.6 10.5-6.6 16.6-16.4 17.2" fill="var(--lime)" />
      <path d="M5 19.5C9 14 13 10.5 18 7" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Logotipo VIVA: wordmark com a folha no lugar do pingo do "i". */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-5xl" }[size];
  const leaf = { sm: "h-2.5 w-2.5 -top-[0.05em]", md: "h-3 w-3 -top-[0.02em]", lg: "h-6 w-6 top-[0.02em]" }[size];
  return (
    <span className={cn("inline-flex items-baseline font-display font-extrabold tracking-[-0.04em] text-ink", text, className)}>
      <span className="sr-only">VIVA</span>
      <span aria-hidden className="inline-flex items-baseline">
        v
        <span className="relative inline-block">
          ı
          <Leaf className={cn("absolute left-1/2 -translate-x-[35%]", leaf)} />
        </span>
        va
      </span>
    </span>
  );
}
