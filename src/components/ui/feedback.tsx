"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { Celebration } from "@/lib/action-types";
import { cn } from "./cn";
import { DynamicIcon } from "./dynamic-icon";

// ─────────────────────────────────────────────────────────────
// Toasts
// ─────────────────────────────────────────────────────────────

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface FeedbackContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  celebrate: (items: Celebration[]) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback precisa estar dentro de FeedbackProvider");
  return ctx;
}

const TONE_STYLE: Record<ToastTone, { icon: ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-lime-text" aria-hidden />, className: "" },
  error: { icon: <TriangleAlert className="h-5 w-5 text-danger-text" aria-hidden />, className: "" },
  info: { icon: <Info className="h-5 w-5 text-sky-text" aria-hidden />, className: "" },
};

export function FeedbackProvider({ children, celebrations = true }: { children: ReactNode; celebrations?: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );

  const celebrate = useCallback(
    (items: Celebration[]) => {
      if (items.length === 0) return;
      if (!celebrations) {
        for (const c of items) toast(`${c.title}${c.xp ? ` · +${c.xp} XP` : ""}`, "success");
        return;
      }
      setQueue((q) => [...q, ...items]);
    },
    [celebrations, toast],
  );

  const value = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);

  return (
    <FeedbackContext value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-2xl border border-line-strong bg-surface-2/95 px-4 py-3 text-sm shadow-lift backdrop-blur",
              TONE_STYLE[t.tone].className,
            )}
          >
            {TONE_STYLE[t.tone].icon}
            <p className="flex-1 pt-0.5">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:text-ink"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {queue.length > 0 && <CelebrationOverlay item={queue[0]} onClose={() => setQueue((q) => q.slice(1))} />}
    </FeedbackContext>
  );
}

// ─────────────────────────────────────────────────────────────
// Celebração (conquista, nível, desafio)
// ─────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["var(--lime)", "var(--coral)", "var(--sky)", "var(--amber)"];

function CelebrationOverlay({ item, onClose }: { item: Celebration; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 7) * 0.08,
        duration: 1.6 + ((i * 13) % 10) / 10,
        drift: `${((i * 29) % 40) - 20}vw`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + (i % 3) * 3,
      })),
    [],
  );

  const eyebrow = item.kind === "level" ? "Novo nível" : item.kind === "challenge" ? "Desafio concluído" : "Conquista desbloqueada";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-6 backdrop-blur-sm animate-fade"
      onClick={onClose}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute top-0 block rounded-[2px]"
            style={{
              left: `${p.left}%`,
              width: p.w,
              height: p.w * 1.6,
              background: p.color,
              animation: `confetti-fall ${p.duration}s ${p.delay}s cubic-bezier(.3,.6,.5,1) both`,
              ["--drift" as string]: p.drift,
            }}
          />
        ))}
      </div>
      <div
        className="relative w-full max-w-sm animate-pop rounded-[2rem] border border-line-strong bg-surface p-7 text-center shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[1.6rem] bg-lime text-lime-ink" style={{ animation: "check-pop .6s .15s both" }}>
          <DynamicIcon name={item.icon} className="h-9 w-9" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-text">{eyebrow}</p>
        <h2 id="celebration-title" className="mt-1 text-2xl font-extrabold">
          {item.title}
        </h2>
        <p className="mt-2 text-sm text-ink-2">{item.description}</p>
        {item.xp ? <p className="mt-3 font-display text-lg font-bold text-lime-text">+{item.xp} XP</p> : null}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-full bg-lime font-semibold text-lime-ink active:scale-[0.98]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
