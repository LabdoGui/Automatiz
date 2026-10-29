import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { readUiPrefs } from "@/server/ui-prefs";
import { FeedbackProvider } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: { default: "VIVA — Seu plano, seu ritmo.", template: "%s · VIVA" },
  description:
    "Planejamento alimentar semanal, lista de compras com orçamento, treinos e progresso — em um só lugar, no seu ritmo.",
  applicationName: "VIVA",
  appleWebApp: { capable: true, title: "VIVA", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#f3f1ea" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = readUiPrefs(await cookies());
  return (
    <html lang="pt-BR" data-theme={prefs.theme} data-motion={prefs.motion} suppressHydrationWarning>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:text-lime-ink"
        >
          Pular para o conteúdo
        </a>
        <FeedbackProvider celebrations={prefs.celebrate}>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
