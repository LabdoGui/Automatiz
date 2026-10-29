"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleMealAction } from "@/server/actions/planner";
import { useFeedback } from "../ui/feedback";
import { cn } from "../ui/cn";

/** Botão grande para marcar refeição como concluída (atualização otimista). */
export function MealCheck({
  mealId,
  completed,
  title,
  size = "md",
  onLime = false,
}: {
  mealId: string;
  completed: boolean;
  title: string;
  size?: "md" | "lg";
  onLime?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(completed);
  const [pending, start] = useTransition();
  const { toast, celebrate } = useFeedback();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Desmarcar ${title} como concluída` : `Marcar ${title} como concluída`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleMealAction(mealId, !optimistic);
          if (!res.ok) toast(res.error, "error");
          else if (res.celebrations?.length) celebrate(res.celebrations);
        })
      }
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90",
        size === "lg" ? "h-14 w-14" : "h-11 w-11",
        onLime
          ? optimistic
            ? "border-lime-ink bg-lime-ink text-lime"
            : "border-lime-ink/40 text-transparent hover:border-lime-ink hover:text-lime-ink"
          : optimistic
            ? "border-lime bg-lime text-lime-ink"
            : "border-line-strong text-transparent hover:border-lime hover:text-lime-text",
      )}
    >
      <Check className={cn(size === "lg" ? "h-7 w-7" : "h-5 w-5", optimistic && "animate-[check-pop_.35s_ease-out]")} strokeWidth={3} aria-hidden />
    </button>
  );
}
