import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Mascot } from "@/components/brand/mascot";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
      <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-raised p-10 lg:flex">
          <Link href="/" aria-label="Página inicial do VIVA">
            <Logo />
          </Link>
          <div>
            <Mascot stage="muda" size={180} />
            <p className="mt-6 max-w-sm font-display text-4xl leading-[1] font-extrabold tracking-[-0.03em]">
              Pequenos passos.
              <br />
              <span className="text-lime-text">Semana organizada.</span>
            </p>
          </div>
          <p className="text-sm text-ink-3">O VIVA é uma ferramenta de organização. Não substitui orientação profissional.</p>
        </aside>
        <main id="conteudo" className="flex flex-col px-5 py-6 sm:px-10">
          <Link href="/" className="mb-10 lg:hidden" aria-label="Página inicial do VIVA">
            <Logo />
          </Link>
          <div className="mx-auto my-auto w-full max-w-md animate-rise py-6">{children}</div>
        </main>
      </div>
  );
}
