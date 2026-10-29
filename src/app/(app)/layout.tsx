import Link from "next/link";
import { ShoppingBasket, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { BottomNav, SideNav } from "@/components/shell/nav";
import { FeedbackProvider } from "@/components/ui/feedback";
import { levelFromXp } from "@/domain/gamification/rules";
import { requireOnboardedUser } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, settings } = await requireOnboardedUser();
  const level = levelFromXp(profile.xpTotal);

  const levelChip = (
    <Link
      href="/conquistas"
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong pr-3 pl-1 text-sm font-semibold hover:bg-surface-2"
      aria-label={`Nível ${level.level}, ${level.xp} XP. Ver conquistas`}
    >
      <span className="grid h-7 min-w-7 place-items-center rounded-full bg-lime px-1.5 font-display text-xs font-extrabold text-lime-ink">
        {level.level}
      </span>
      <span className="tabular text-ink-2">{level.xp} XP</span>
    </Link>
  );

  return (
    <FeedbackProvider celebrations={settings?.celebrations ?? true}>
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line px-4 py-6 lg:flex">
          <Link href="/inicio" className="px-3.5" aria-label="VIVA — início">
            <Logo />
          </Link>
          <SideNav />
          <div className="mt-auto px-1">{levelChip}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-xl lg:hidden">
            <Link href="/inicio" aria-label="VIVA — início">
              <Logo size="sm" />
            </Link>
            <div className="flex items-center gap-1.5">
              <Link
                href="/compras"
                className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                aria-label="Lista de compras"
              >
                <ShoppingBasket className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href="/assistente"
                className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                aria-label="Assistente"
              >
                <Sparkles className="h-5 w-5" aria-hidden />
              </Link>
              {levelChip}
            </div>
          </header>

          <main id="conteudo" className="w-full flex-1 px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
      <BottomNav />
    </FeedbackProvider>
  );
}
