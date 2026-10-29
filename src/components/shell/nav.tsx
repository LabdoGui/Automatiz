"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  House,
  LineChart,
  ShoppingBasket,
  Sparkles,
  Trophy,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../ui/cn";

export const PRIMARY_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/alimentacao", label: "Alimentação", icon: UtensilsCrossed },
  { href: "/treino", label: "Treino", icon: Dumbbell },
  { href: "/progresso", label: "Progresso", icon: LineChart },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export const SECONDARY_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/compras", label: "Compras", icon: ShoppingBasket },
  { href: "/conquistas", label: "Conquistas", icon: Trophy },
  { href: "/assistente", label: "Assistente", icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-semibold text-ink-3 aria-[current=page]:text-ink"
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-colors duration-200",
                    active ? "bg-lime text-lime-ink" : "group-hover:bg-surface-2",
                  )}
                >
                  <Icon className="h-[1.2rem] w-[1.2rem]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof PRIMARY_NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.95rem] font-semibold transition-colors",
            active ? "bg-lime text-lime-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
          {label}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6">
      <ul className="flex flex-col gap-1">{PRIMARY_NAV.map(item)}</ul>
      <div>
        <p className="mb-2 px-3.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink-3">Atalhos</p>
        <ul className="flex flex-col gap-1">{SECONDARY_NAV.map(item)}</ul>
      </div>
    </nav>
  );
}
