"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../ui/cn";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "../ui/button";
import { useFieldError, useFormPending } from "./action-form";

const inputBase =
  "w-full rounded-2xl border border-line bg-surface-2 px-4 text-[1rem] text-ink placeholder:text-ink-3 " +
  "transition-colors focus:border-lime focus:bg-surface focus:outline-none aria-[invalid=true]:border-danger";

interface BaseFieldProps {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  labelHidden?: boolean;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  labelHidden,
  children,
  suffix,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  labelHidden?: boolean;
  children: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-semibold text-ink", labelHidden && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        {children}
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-ink-3">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: string | undefined) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({
  name,
  label,
  hint,
  className,
  labelHidden,
  suffix,
  ...props
}: BaseFieldProps & Omit<ComponentProps<"input">, "name"> & { suffix?: ReactNode }) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} labelHidden={labelHidden} suffix={suffix}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputBase, "h-12", suffix ? "pr-14" : undefined)}
        {...props}
      />
    </FieldShell>
  );
}

/** Campo numérico com teclado decimal no celular (aceita vírgula). */
export function NumberField({
  name,
  label,
  hint,
  className,
  labelHidden,
  suffix,
  decimal = false,
  ...props
}: BaseFieldProps & Omit<ComponentProps<"input">, "name" | "type"> & { suffix?: ReactNode; decimal?: boolean }) {
  return (
    <TextField
      name={name}
      label={label}
      hint={hint}
      className={className}
      labelHidden={labelHidden}
      suffix={suffix}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      {...props}
    />
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  labelHidden,
  children,
  ...props
}: BaseFieldProps & Omit<ComponentProps<"select">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} labelHidden={labelHidden}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputBase, "h-12 appearance-none pr-10")}
        {...props}
      >
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-ink-3">
        ▾
      </span>
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  className,
  labelHidden,
  ...props
}: BaseFieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} labelHidden={labelHidden}>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputBase, "min-h-24 py-3 leading-relaxed")}
        {...props}
      />
    </FieldShell>
  );
}

/** Erro de um grupo de opções (chips/segmentos) sem campo de texto próprio. */
export function GroupError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>;
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  block,
  className,
  pendingLabel = "Salvando…",
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  pendingLabel?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const pending = useFormPending();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClasses({ variant, size, block, className })}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
