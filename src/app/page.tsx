import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Mascot } from "@/components/brand/mascot";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/server/session";

const PILLARS = [
  {
    n: "01",
    title: "Semana planejada em minutos",
    text: "Refeições de segunda a domingo que respeitam alergias, gostos, utensílios e tempo para cozinhar.",
  },
  {
    n: "02",
    title: "Lista de compras que cabe no bolso",
    text: "Ingredientes consolidados, embalagens calculadas, despensa descontada e orçamento sempre à vista.",
  },
  {
    n: "03",
    title: "Treino com instruções de verdade",
    text: "Catálogo por grupo muscular, rotinas A/B/C, registro de cargas e histórico de evolução.",
  },
  {
    n: "04",
    title: "Constância que dá vontade de manter",
    text: "XP, conquistas e desafios que celebram hábitos — nunca restrição, nunca culpa.",
  },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/inicio");
  const { conta } = await searchParams;

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Acesso">
          <LinkButton href="/entrar" variant="ghost" size="sm">
            Entrar
          </LinkButton>
          <LinkButton href="/criar-conta" size="sm">
            Criar conta
          </LinkButton>
        </nav>
      </header>

      <main id="conteudo">
        {conta === "excluida" && (
          <p role="status" className="mx-auto mb-4 max-w-6xl px-5 text-sm text-ink-2 sm:px-8">
            Sua conta e seus dados foram excluídos. Obrigado por ter usado o VIVA.
          </p>
        )}
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:pt-14">
          <div className="animate-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
              Alimentação · Treino · Orçamento
            </p>
            <h1 className="text-[3.1rem] leading-[0.92] font-extrabold tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
              Seu plano,
              <br />
              <span className="text-lime-text">seu ritmo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              O VIVA organiza sua semana de refeições, transforma o plano em uma lista de compras realista e acompanha seus treinos —
              com dados nutricionais de fonte pública e sem prometer milagres.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/criar-conta" size="lg">
                Começar agora <ArrowRight className="h-5 w-5" aria-hidden />
              </LinkButton>
              <LinkButton href="/entrar" variant="outline" size="lg">
                Já tenho conta
              </LinkButton>
            </div>
          </div>

          <div className="relative mx-auto grid aspect-square w-full max-w-md place-items-center">
            <div aria-hidden className="absolute inset-6 rounded-full bg-lime/10 blur-3xl" />
            <div aria-hidden className="grain absolute inset-0 rounded-[3rem] border border-line bg-surface/60" />
            <div className="relative flex flex-col items-center gap-2">
              <Mascot stage="planta" size={220} />
              <p className="font-display text-sm font-bold text-ink-2">Este é o Broto. Ele cresce com a sua constância.</p>
            </div>
            <div aria-hidden className="absolute -top-2 -right-1 rotate-3 rounded-2xl bg-lime px-4 py-3 text-lime-ink shadow-lift sm:-right-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider">Exemplo · compras</p>
              <p className="font-display text-xl font-extrabold">Lista da semana</p>
            </div>
            <div aria-hidden className="absolute top-12 -left-1 -rotate-3 rounded-2xl border border-line-strong bg-surface-2 px-4 py-3 shadow-lift sm:-left-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">Exemplo · treino B</p>
              <p className="font-display text-xl font-extrabold">Costas e bíceps</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="pilares" className="border-y border-line bg-raised">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 id="pilares" className="max-w-xl text-3xl font-extrabold sm:text-4xl">
              Tudo o que a sua rotina precisa, conversando entre si.
            </h2>
            <ol className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {PILLARS.map((p) => (
                <li key={p.n} className="flex gap-5 border-t border-line pt-5">
                  <span className="font-display text-sm font-bold text-lime-text">{p.n}</span>
                  <div>
                    <h3 className="text-xl font-bold">{p.title}</h3>
                    <p className="mt-1.5 text-ink-2">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8" aria-labelledby="transparencia">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
            <h2 id="transparencia" className="text-3xl font-extrabold sm:text-4xl">
              Transparente por padrão.
            </h2>
            <ul className="space-y-4 text-ink-2">
              {[
                "Valores nutricionais calculados a partir da Tabela Brasileira de Composição de Alimentos (TACO/UNICAMP), com a fonte sempre visível.",
                "Preços nunca são inventados: você informa, importa por planilha ou registra o valor pago — e cada preço mostra origem e data.",
                "Metas de profissionais ficam separadas de estimativas educativas. O VIVA não substitui nutricionista, médico ou educador físico.",
                "Seus dados de saúde são seus: exporte ou exclua tudo a qualquer momento.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-lime-text" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-3 sm:px-8">
          <Logo size="sm" />
          <div className="flex gap-5">
            <Link href="/privacidade" className="hover:text-ink">
              Privacidade e dados
            </Link>
            <Link href="/privacidade#saude" className="hover:text-ink">
              Aviso de saúde
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
