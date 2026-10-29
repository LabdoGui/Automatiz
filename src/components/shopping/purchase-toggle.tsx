"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { togglePurchasedAction } from "@/server/actions/shopping";
import { useFeedback } from "../ui/feedback";
import { cn } from "../ui/cn";

export function PurchaseToggle({ itemId, purchased, name, disabled }: { itemId: string; purchased: boolean; name: string; disabled?: boolean }) {
  const [optimistic, set] = useOptimistic(purchased);
  const [pending, start] = useTransition();
  const { toast } = useFeedback();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${name}: ${optimistic ? "comprado" : "a comprar"}`}
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          const res = await togglePurchasedAction(itemId, !optimistic);
          if (!res.ok) toast(res.error, "error");
        })
      }
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-colors",
        optimistic ? "border-lime bg-lime text-lime-ink" : "border-line-strong text-transparent hover:border-lime",
      )}
    >
      <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
    </button>
  );
}
