import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VIVA — Seu plano, seu ritmo.",
    short_name: "VIVA",
    description: "Planejamento alimentar, treinos, compras com orçamento e hábitos — em português, com dados reais.",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d0c",
    theme_color: "#0b0d0c",
    categories: ["health", "fitness", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoje", url: "/inicio" },
      { name: "Lista de compras", url: "/compras" },
      { name: "Treino", url: "/treino" },
    ],
  };
}
