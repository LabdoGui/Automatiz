import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "coral" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-lime text-lime-ink hover:brightness-[1.06] shadow-[0_8px_24px_-12px_var(--lime)]",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-danger-soft text-danger-text hover:bg-danger hover:text-white",
  coral: "bg-coral text-coral-ink hover:brightness-[1.06]",
  outline: "border border-line-strong text-ink hover:bg-surface-2",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
  icon: "h-11 w-11 justify-center",
  "icon-sm": "h-9 w-9 justify-center",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap select-none",
    "transition-[transform,background-color,filter,color] duration-150 active:scale-[0.97]",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function LinkButton({ variant, size, block, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...props} />;
}
