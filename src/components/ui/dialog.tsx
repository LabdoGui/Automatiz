"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button";
import { cn } from "./cn";

interface DialogControl {
  close: () => void;
}

const DialogContext = createContext<DialogControl | null>(null);

export function useDialogControl(): DialogControl | null {
  return useContext(DialogContext);
}

/**
 * Diálogo acessível baseado em <dialog> nativo (foco preso e Esc nativos).
 * No celular aparece como folha inferior; no desktop, centralizado.
 */
export function Dialog({
  title,
  description,
  trigger,
  triggerVariant = "secondary",
  triggerSize = "md",
  triggerClassName,
  triggerLabel,
  children,
  wide = false,
  defaultOpen = false,
}: {
  title: string;
  description?: ReactNode;
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  /** Rótulo acessível quando o gatilho é só um ícone */
  triggerLabel?: string;
  children: ReactNode;
  wide?: boolean;
  defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const show = useCallback(() => {
    setOpen(true);
    ref.current?.showModal();
  }, []);
  const close = useCallback(() => {
    ref.current?.close();
  }, []);

  useEffect(() => {
    if (defaultOpen) show();
  }, [defaultOpen, show]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        className={buttonClasses({ variant: triggerVariant, size: triggerSize, className: triggerClassName })}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className={cn(
          "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[1.75rem] border border-line-strong bg-surface p-0 text-ink shadow-lift",
          "sm:m-auto sm:max-h-[85dvh] sm:rounded-[1.75rem]",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          "open:animate-rise",
        )}
      >
        <DialogContext value={{ close }}>
          {open && (
            <div className="px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-6">
              <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" />
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 id={titleId} className="text-xl font-extrabold">
                    {title}
                  </h2>
                  {description && <div className="mt-1 text-sm text-ink-2">{description}</div>}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              {children}
            </div>
          )}
        </DialogContext>
      </dialog>
    </>
  );
}

export function DialogClose({ children, variant = "ghost" }: { children: ReactNode; variant?: ButtonVariant }) {
  const ctl = useDialogControl();
  return (
    <button type="button" onClick={() => ctl?.close()} className={buttonClasses({ variant })}>
      {children}
    </button>
  );
}
