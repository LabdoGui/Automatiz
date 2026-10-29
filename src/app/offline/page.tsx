import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <Logo size="md" />
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-2">
        <WifiOff className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold">Sem conexão</h1>
        <p className="mt-2 text-ink-2">
          O VIVA precisa de internet para mostrar e salvar seus dados com segurança. Por privacidade, suas informações não ficam guardadas
          neste aparelho. Assim que a conexão voltar, é só tentar de novo.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
