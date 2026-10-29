"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import type { ActionResult, ActionState, FieldErrors } from "@/lib/action-types";
import { useFeedback } from "../ui/feedback";
import { useDialogControl } from "../ui/dialog";
import { cn } from "../ui/cn";

const FormErrorsContext = createContext<FieldErrors>({});
const FormPendingContext = createContext(false);

export function useFieldError(name: string): string | undefined {
  return useContext(FormErrorsContext)[name]?.[0];
}

export function useFormPending(): boolean {
  return useContext(FormPendingContext);
}

type Action<T> = (state: unknown, formData: FormData) => Promise<ActionResult<T>>;

/**
 * Formulário ligado a uma Server Action:
 *  - mostra erros por campo e um resumo acessível;
 *  - exibe toast de sucesso/erro e celebrações retornadas pela action;
 *  - não limpa os campos quando há erro de validação.
 */
export function ActionForm<T>({
  action,
  children,
  className,
  resetOnSuccess = false,
  closeDialogOnSuccess = false,
  redirectTo,
  onSuccess,
  showSuccessToast = true,
  id,
  "aria-label": ariaLabel,
}: {
  action: Action<T>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  closeDialogOnSuccess?: boolean;
  redirectTo?: string;
  onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void;
  showSuccessToast?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState<T>, FormData>(action, null);
  const { toast, celebrate } = useFeedback();
  const dialog = useDialogControl();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (showSuccessToast && state.message) toast(state.message, "success");
      if (state.celebrations?.length) celebrate(state.celebrations);
      if (resetOnSuccess) formRef.current?.reset();
      if (closeDialogOnSuccess) dialog?.close();
      onSuccess?.(state);
      const dynamicTarget = (state.data as { redirectTo?: unknown } | undefined)?.redirectTo;
      if (typeof dynamicTarget === "string" && dynamicTarget.startsWith("/")) router.push(dynamicTarget);
      else if (redirectTo) router.push(redirectTo);
    } else if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) {
      toast(state.error, "error");
    } else {
      summaryRef.current?.focus();
    }
    // Reage apenas a novos resultados da action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <FormErrorsContext value={fieldErrors}>
      <FormPendingContext value={pending}>
        <form ref={formRef} id={id} onSubmit={handleSubmit} className={className} aria-label={ariaLabel} noValidate>
          {state && !state.ok && hasFieldErrors && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-text outline-none"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{state.error}</p>
            </div>
          )}
          {children}
        </form>
      </FormPendingContext>
    </FormErrorsContext>
  );
}

export function FormMessage({ children, tone = "info", className }: { children: ReactNode; tone?: "info" | "warning"; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-2xl px-4 py-3 text-sm",
        tone === "warning" ? "bg-amber-soft text-amber-text" : "bg-surface-2 text-ink-2",
        className,
      )}
    >
      {children}
    </p>
  );
}
